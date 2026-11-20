// Estudios DICOM del tomógrafo (bridge PACS) por atención.
// El navegador nunca ve pacsUrl ni rutas de archivo: solo ids opacos ligados a la cuenta.
const { config } = require('../config');
const { listarHabilitadas } = require('../clinicas/empresas');
const { pedirAClinica } = require('../clinicas/clinicaHttp');
const { getClinicSource, conTimeout } = require('../clinicas/source');
const { confirmadosPorEmpresa } = require('./vinculos');
const { sealId, openId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');
const logger = require('../lib/logger');

const KIND_EST = 'pacs';
const KIND_FILE = 'pacsfile';
const TIMEOUT_MS = Number(process.env.PACS_TIMEOUT_MS || 60_000);

function ymd(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}${m[2]}${m[3]}` : '';
}

function visitaCubreFecha(visita, studyDateYmd) {
  const f = ymd(studyDateYmd);
  const d = ymd(visita?.desde);
  if (!f || !d) return false;
  const h = ymd(visita?.hasta);
  return f >= d && (!h || f <= h);
}

function visitaDueniaDelEstudio(studyDate, visitasPaciente) {
  const f = ymd(studyDate);
  if (!f || !Array.isArray(visitasPaciente) || !visitasPaciente.length) return null;
  return visitasPaciente.find((v) => visitaCubreFecha(v, f)) || null;
}

function filtrarEstudiosDeVisita(studies, { numeroVisita, desde, hasta, visitasPaciente }) {
  const nv = String(numeroVisita);
  const d = ymd(desde);
  const h = ymd(hasta);
  return (studies || []).filter((s) => {
    const acc = String(s.accessionNumber || '').replace(/\D/g, '');
    if (acc) return acc === nv;
    const f = ymd(s.studyDate);
    if (!f || !d) return false;
    if (!(f >= d && (!h || f <= h))) return false;
    if (!Array.isArray(visitasPaciente) || !visitasPaciente.length) return true;
    const duenia = visitaDueniaDelEstudio(f, visitasPaciente);
    return duenia != null && String(duenia.numeroVisita) === nv;
  });
}

function fechaDicom(d, t) {
  const s = String(d || '');
  if (!/^\d{8}$/.test(s)) return s || null;
  const fecha = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  const h = String(t || '');
  return /^\d{4}/.test(h) ? `${fecha}T${h.slice(0, 2)}:${h.slice(2, 4)}:00` : fecha;
}

function noDisponible(empresa, err) {
  logger.warn('pacs_clinica_no_disponible', { idEmpresa: empresa.idEmpresa, code: err?.code, status: err?.status });
  const e = new Error(`Las imágenes de ${empresa.nombre} no están disponibles ahora. Probá de nuevo en unos minutos.`);
  e.status = 503;
  e.code = 'PACS_NO_DISPONIBLE';
  return e;
}

async function contextoAtencion(cuenta, idAtencion) {
  const ref = openId(idAtencion);
  if (!ref || ref.c !== cuenta.id || ref.k) throw notFound('Atención no encontrada');
  const [empresas, vinculos] = await Promise.all([listarHabilitadas(), confirmadosPorEmpresa(cuenta.id)]);
  const empresa = empresas.find((e) => e.idEmpresa === ref.e);
  const ids = vinculos.get(ref.e);
  if (!empresa || !ids?.length) throw notFound('Atención no encontrada');
  const habilitado = new Set(empresa.seccionesVisibles).has('pacs') && Boolean(empresa.pacsUrl || config.MOCK_MODE);
  return { empresa, ids, numeroVisita: ref.v, habilitado };
}

async function bridgeJson(empresa, ruta) {
  if (config.MOCK_MODE) return null;
  const res = await pedirAClinica({ servicio: 'pacs', idEmpresa: empresa.idEmpresa, ruta, timeoutMs: TIMEOUT_MS });
  if (!res.ok) {
    const err = new Error(`PACS HTTP ${res.status}`);
    err.status = res.status;
    err.code = 'PACS_BRIDGE_ERROR';
    throw err;
  }
  return res.json();
}

async function listarPorAtencion(cuenta, idAtencion) {
  const { empresa, ids, numeroVisita, habilitado } = await contextoAtencion(cuenta, idAtencion);
  const out = {
    publicados: habilitado,
    disponible: false,
    desde: null,
    hasta: null,
    egresada: false,
    estudios: [],
    _ref: { idEmpresa: empresa.idEmpresa, numeroVisita }
  };
  if (!habilitado) return out;

  let ctx;
  try {
    ctx = await conTimeout(getClinicSource().contextoPacsVisita(empresa.idEmpresa, numeroVisita, ids));
  } catch (err) {
    throw noDisponible(empresa, err);
  }
  if (!ctx) throw notFound('Atención no encontrada');

  out.desde = ctx.desde;
  out.hasta = ctx.hasta;
  out.egresada = Boolean(ctx.egresada);

  let studies = [];
  try {
    if (config.MOCK_MODE) {
      studies = await getClinicSource().listarEstudiosPacsMock(empresa.idEmpresa, ctx);
      out.disponible = true;
    } else {
      const health = await pedirAClinica({
        servicio: 'pacs',
        idEmpresa: empresa.idEmpresa,
        ruta: '/health',
        timeoutMs: Math.min(TIMEOUT_MS, 10_000)
      }).catch(() => null);
      out.disponible = Boolean(health?.ok);
      if (!out.disponible) return out;
      const data = await bridgeJson(empresa, `/studies?patientId=${encodeURIComponent(ctx.documento)}`);
      studies = data?.studies || data || [];
    }
  } catch (err) {
    throw noDisponible(empresa, err);
  }

  const filtrados = filtrarEstudiosDeVisita(studies, {
    numeroVisita,
    desde: ctx.desde,
    hasta: ctx.hasta,
    visitasPaciente: ctx.visitasPaciente
  });

  out.estudios = filtrados.map((s) => {
    const uid = String(s.studyInstanceUid || s.StudyInstanceUID || '');
    return {
      id: sealId({ k: KIND_EST, c: cuenta.id, e: empresa.idEmpresa, v: numeroVisita, u: uid }),
      fecha: fechaDicom(s.studyDate || s.StudyDate, s.studyTime || s.StudyTime),
      descripcion: String(s.studyDescription || s.StudyDescription || 'Estudio de imágenes').trim(),
      modalidad: String(s.modalitiesInStudy || s.ModalitiesInStudy || s.modality || '').trim() || null,
      seriesCount: Number(s.numberOfStudyRelatedSeries || s.seriesCount || 0) || null,
      instanceCount: Number(s.numberOfStudyRelatedInstances || s.instanceCount || 0) || null
    };
  });
  return out;
}

async function resolverEstudio(cuenta, idEstudio) {
  const ref = openId(idEstudio);
  if (!ref || ref.k !== KIND_EST || !ref.u) throw notFound('Estudio no encontrado');
  const ctx = await contextoAtencion(cuenta, sealId({ c: ref.c, e: ref.e, v: ref.v }));
  if (ref.c !== cuenta.id || !ctx.habilitado) throw notFound('Estudio no encontrado');
  return { ...ctx, uid: ref.u, ref };
}

async function listarSeries(cuenta, idEstudio) {
  const { empresa, uid, ref } = await resolverEstudio(cuenta, idEstudio);
  let series = [];
  try {
    if (config.MOCK_MODE) {
      series = await getClinicSource().listarSeriesPacsMock(uid);
    } else {
      const data = await bridgeJson(empresa, `/studies/${encodeURIComponent(uid)}/series`);
      series = data?.series || data || [];
    }
  } catch (err) {
    throw noDisponible(empresa, err);
  }
  return {
    series: series.map((s, i) => ({
      id: String(s.seriesInstanceUid || s.SeriesInstanceUID || i),
      number: s.seriesNumber || s.SeriesNumber || i + 1,
      modality: String(s.modality || s.Modality || '').trim() || null,
      description: String(s.seriesDescription || s.SeriesDescription || '').trim() || null,
      instanceCount: Number(s.numberOfSeriesRelatedInstances || s.instanceCount || 0) || null
    })),
    _ref: { idEmpresa: empresa.idEmpresa, numeroVisita: ref.v, uid }
  };
}

async function listarArchivos(cuenta, idEstudio) {
  const { empresa, uid, ref, ids, numeroVisita } = await resolverEstudio(cuenta, idEstudio);
  let files = [];
  try {
    if (config.MOCK_MODE) {
      files = await getClinicSource().listarArchivosPacsMock(uid);
    } else {
      const data = await bridgeJson(empresa, `/studies/${encodeURIComponent(uid)}/files`);
      files = data?.files || data || [];
    }
  } catch (err) {
    throw noDisponible(empresa, err);
  }
  return {
    archivos: files.map((f, i) => {
      const path = String(f.path || f.filePath || f.name || `frame-${i}.dcm`);
      return {
        id: sealId({ k: KIND_FILE, c: cuenta.id, e: empresa.idEmpresa, v: numeroVisita, u: uid, p: path }),
        nombre: String(f.name || path.split(/[\\/]/).pop() || `imagen-${i + 1}.dcm`),
        size: f.size != null ? Number(f.size) : null,
        seriesUid: f.seriesInstanceUid || f.SeriesInstanceUID || null
      };
    }),
    _ref: { idEmpresa: empresa.idEmpresa, numeroVisita, uid }
  };
}

async function abrirArchivo(cuenta, idArchivo) {
  const ref = openId(idArchivo);
  if (!ref || ref.k !== KIND_FILE || !ref.u || !ref.p) throw notFound('Archivo no encontrado');
  const ctx = await contextoAtencion(cuenta, sealId({ c: ref.c, e: ref.e, v: ref.v }));
  if (ref.c !== cuenta.id || !ctx.habilitado) throw notFound('Archivo no encontrado');

  let res;
  try {
    if (config.MOCK_MODE) {
      res = await getClinicSource().abrirArchivoPacsMock(ref.u, ref.p);
    } else {
      const q = new URLSearchParams({ path: ref.p });
      res = await pedirAClinica({
        servicio: 'pacs',
        idEmpresa: ctx.empresa.idEmpresa,
        ruta: `/studies/${encodeURIComponent(ref.u)}/file?${q}`,
        timeoutMs: TIMEOUT_MS
      });
      if (!res.ok) throw Object.assign(new Error(`PACS file ${res.status}`), { status: res.status, code: 'PACS_BRIDGE_ERROR' });
    }
  } catch (err) {
    throw noDisponible(ctx.empresa, err);
  }

  const nombre = String(ref.p).split(/[\\/]/).pop() || 'estudio.dcm';
  return {
    res,
    headers: {
      'Content-Type': 'application/dicom',
      'Content-Disposition': `inline; filename="${nombre.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store'
    },
    _ref: { idEmpresa: ctx.empresa.idEmpresa, numeroVisita: ref.v, uid: ref.u }
  };
}

async function disponible(cuenta, idEstudio) {
  const { empresa } = await resolverEstudio(cuenta, idEstudio);
  if (config.MOCK_MODE) return { disponible: true, _ref: { idEmpresa: empresa.idEmpresa } };
  try {
    const res = await pedirAClinica({
      servicio: 'pacs',
      idEmpresa: empresa.idEmpresa,
      ruta: '/health',
      timeoutMs: 8_000
    });
    return { disponible: res.ok, _ref: { idEmpresa: empresa.idEmpresa } };
  } catch {
    return { disponible: false, _ref: { idEmpresa: empresa.idEmpresa } };
  }
}

module.exports = {
  listarPorAtencion,
  listarSeries,
  listarArchivos,
  abrirArchivo,
  disponible,
  filtrarEstudiosDeVisita,
  visitaDueniaDelEstudio
};
