// Adjuntos de estudios de una atención (imPedidosEstudiosAdjuntos de cada clínica).
// El navegador solo ve ids opacos ligados a la cuenta; la ruta del archivo y la URL del file server nunca salen del
// backend. Cada apertura vuelve a validar la pertenencia contra la clínica (visita → paciente de un vínculo
// confirmado) y relee la ruta desde la base: el id opaco por sí solo no habilita nada.
const path = require('path');
const { config } = require('../config');
const { listarHabilitadas } = require('../clinicas/empresas');
const { pedirAClinica } = require('../clinicas/clinicaHttp');
const { getClinicSource, conTimeout } = require('../clinicas/source');
const { confirmadosPorEmpresa } = require('./vinculos');
const { sealId, openId } = require('../lib/crypto');
const { notFound } = require('../lib/errors');
const { toIsoDate } = require('../lib/clarion');
const logger = require('../lib/logger');

const KIND = 'adj';
const TIMEOUT_ARCHIVO_MS = 25_000;

const FORMATOS = {
  '.pdf': { mime: 'application/pdf', tipo: 'pdf', inline: true },
  '.jpg': { mime: 'image/jpeg', tipo: 'imagen', inline: true },
  '.jpeg': { mime: 'image/jpeg', tipo: 'imagen', inline: true },
  '.png': { mime: 'image/png', tipo: 'imagen', inline: true },
  '.gif': { mime: 'image/gif', tipo: 'imagen', inline: true },
  '.webp': { mime: 'image/webp', tipo: 'imagen', inline: true },
  '.bmp': { mime: 'image/bmp', tipo: 'imagen', inline: false },
  '.tif': { mime: 'image/tiff', tipo: 'imagen', inline: false },
  '.tiff': { mime: 'image/tiff', tipo: 'imagen', inline: false },
  '.dcm': { mime: 'application/dicom', tipo: 'dicom', inline: false },
  '.mp4': { mime: 'video/mp4', tipo: 'video', inline: true },
  '.webm': { mime: 'video/webm', tipo: 'video', inline: true },
  '.doc': { mime: 'application/msword', tipo: 'documento', inline: false },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', tipo: 'documento', inline: false },
  '.xls': { mime: 'application/vnd.ms-excel', tipo: 'documento', inline: false },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tipo: 'documento', inline: false },
  '.txt': { mime: 'text/plain; charset=utf-8', tipo: 'documento', inline: false }
};
const FORMATO_OTRO = { mime: 'application/octet-stream', tipo: 'otro', inline: false };

const baseName = (ruta) => String(ruta || '').split(/[\\/]/).pop() || '';

/** Nombre visible: la descripción si trae extensión; si no, el nombre del archivo en disco (nunca la carpeta). */
function nombreVisible(a) {
  const desc = baseName(a.descripcion).trim();
  const archivo = baseName(a.ruta).trim();
  const ext = path.extname(archivo);
  let nombre = /\.[a-z0-9]{2,5}$/i.test(desc) ? desc : desc ? `${desc}${ext}` : archivo;
  nombre = nombre.replace(/[\u0000-\u001f"<>|*?:]/g, '_').slice(0, 160);
  return nombre || `adjunto${ext}`;
}

function formatoDe(nombre, ruta) {
  return FORMATOS[path.extname(baseName(ruta)).toLowerCase()] || FORMATOS[path.extname(nombre).toLowerCase()] || FORMATO_OTRO;
}

const fechaDe = (f) => (f == null || f === '' ? null : /^\d+$/.test(String(f)) ? toIsoDate(f) : String(f).slice(0, 19));

const publicadoSegunDemora = (fecha, horas) =>
  !horas || (fecha && Date.now() - Date.parse(fecha.length === 10 ? `${fecha}T00:00:00Z` : `${fecha}Z`) >= horas * 3_600_000);

function visible(empresa, a) {
  if (!a.ruta) return false;
  if (empresa.tiposAdjuntoVisibles && !empresa.tiposAdjuntoVisibles.includes(String(a.tipoImagen || '').trim())) return false;
  return publicadoSegunDemora(fechaDe(a.fecha), empresa.demoraPublicacionHoras);
}

function noDisponible(empresa, err) {
  logger.warn('adjuntos_clinica_no_disponible', { idEmpresa: empresa.idEmpresa, code: err?.code, status: err?.status });
  const e = new Error(`Los archivos de ${empresa.nombre} no están disponibles ahora. Probá de nuevo en unos minutos.`);
  e.status = 503;
  e.code = 'ADJUNTOS_NO_DISPONIBLES';
  return e;
}

/** Empresa e IDPaciente confirmados para una referencia {c, e, v} ya abierta; 404 si no es de la cuenta. */
async function contexto(cuenta, ref) {
  if (!ref || ref.c !== cuenta.id || !Number.isInteger(ref.e) || !Number.isInteger(ref.v)) throw notFound('Adjunto no encontrado');
  const [empresas, vinculos] = await Promise.all([listarHabilitadas(), confirmadosPorEmpresa(cuenta.id)]);
  const empresa = empresas.find((e) => e.idEmpresa === ref.e);
  const ids = vinculos.get(ref.e);
  if (!empresa || !ids?.length) throw notFound('Adjunto no encontrado');
  return { empresa, ids, habilitado: new Set(empresa.seccionesVisibles).has('adjuntos') };
}

async function listar(cuenta, idAtencion) {
  const ref = openId(idAtencion);
  if (ref?.k) throw notFound('Atención no encontrada');
  const { empresa, ids, habilitado } = await contexto(cuenta, ref);
  const out = { adjuntos: [], publicados: habilitado, _ref: { idEmpresa: empresa.idEmpresa, numeroVisita: ref.v } };
  if (!habilitado) return out;

  let filas;
  try {
    filas = await conTimeout(getClinicSource().listarAdjuntos(empresa.idEmpresa, ref.v, ids));
  } catch (err) {
    throw noDisponible(empresa, err);
  }
  if (filas === null) {
    logger.warn('adjuntos_sin_permiso', { idEmpresa: empresa.idEmpresa });
    return { ...out, publicados: false };
  }

  out.adjuntos = filas
    .filter((a) => visible(empresa, a))
    .map((a) => {
      const nombre = nombreVisible(a);
      const f = formatoDe(nombre, a.ruta);
      return {
        id: sealId({ k: KIND, c: cuenta.id, e: empresa.idEmpresa, v: ref.v, a: a.idAdjunto }),
        nombre,
        extension: path.extname(nombre).slice(1).toLowerCase() || null,
        tipo: f.tipo,
        vistaPrevia: f.inline,
        categoria: a.tipoImagenNombre || null,
        fecha: fechaDe(a.fecha)
      };
    });
  return out;
}

async function resolver(cuenta, idAdjunto) {
  const ref = openId(idAdjunto);
  if (!ref || ref.k !== KIND || !Number.isInteger(ref.a)) throw notFound('Adjunto no encontrado');
  const ctx = await contexto(cuenta, ref);
  if (!ctx.habilitado) throw notFound('Adjunto no encontrado');
  let a;
  try {
    a = await conTimeout(getClinicSource().obtenerAdjunto(ctx.empresa.idEmpresa, ref.v, ref.a, ctx.ids));
  } catch (err) {
    throw noDisponible(ctx.empresa, err);
  }
  if (!a || !visible(ctx.empresa, a)) throw notFound('Adjunto no encontrado');
  return { ...ctx, ref, adjunto: a };
}

/**
 * Abre el archivo en el file server de la clínica. Devuelve el Response de la clínica (cuerpo sin consumir) y los
 * headers que tiene que ver el navegador. `descargar` fuerza attachment.
 */
async function abrir(cuenta, idAdjunto, { descargar = false } = {}) {
  const { empresa, ref, adjunto } = await resolver(cuenta, idAdjunto);
  const nombre = nombreVisible(adjunto);
  const formato = formatoDe(nombre, adjunto.ruta);

  let res;
  try {
    res = await getClinicSource().abrirArchivoAdjunto(empresa.idEmpresa, adjunto.ruta, { timeoutMs: TIMEOUT_ARCHIVO_MS });
  } catch (err) {
    throw noDisponible(empresa, err);
  }
  if (!res || res.status === 404) {
    logger.warn('adjunto_archivo_inexistente', { idEmpresa: empresa.idEmpresa });
    throw notFound('El archivo no está en el servidor de la clínica.', 'ADJUNTO_SIN_ARCHIVO');
  }
  if (res.status !== 200 || !res.body) {
    await res.body?.cancel().catch(() => {});
    if (res.status === 401 || res.status === 403) logger.error('file_server_rechazo_firma', { idEmpresa: empresa.idEmpresa, status: res.status });
    throw noDisponible(empresa, { code: 'FILE_SERVER_HTTP', status: res.status });
  }

  const ascii = nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'adjunto';
  const disposicion = descargar || !formato.inline ? 'attachment' : 'inline';
  const headers = {
    'Content-Type': formato.mime,
    'Content-Disposition': `${disposicion}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  const largo = Number(res.headers.get('content-length'));
  if (Number.isFinite(largo) && largo > 0) headers['Content-Length'] = String(largo);

  return { res, headers, _ref: { idEmpresa: empresa.idEmpresa, numeroVisita: ref.v, idAdjunto: ref.a } };
}

/** Verifica pertenencia y que el túnel de la clínica responda, sin bajar el archivo. */
async function disponible(cuenta, idAdjunto) {
  const { empresa, ref } = await resolver(cuenta, idAdjunto);
  let ok = true;
  if (!config.MOCK_MODE) {
    try {
      const r = await pedirAClinica({ servicio: 'fs', idEmpresa: empresa.idEmpresa, ruta: '/health', timeoutMs: 6000 });
      await r.body?.cancel().catch(() => {});
      ok = r.status === 200;
    } catch {
      ok = false;
    }
  }
  return { disponible: ok, _ref: { idEmpresa: empresa.idEmpresa, numeroVisita: ref.v, idAdjunto: ref.a } };
}

module.exports = { listar, abrir, disponible, nombreVisible, formatoDe };
