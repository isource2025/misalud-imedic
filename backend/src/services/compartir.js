// Links temporales para compartir un estudio PACS, un adjunto o el PDF de una atención.
const { getRepos } = require('../repos');
const { sha256, randomToken, openId } = require('../lib/crypto');
const { config } = require('../config');
const { badRequest, notFound, gone } = require('../lib/errors');
const atenciones = require('./atenciones');
const adjuntos = require('./adjuntos');
const pacs = require('./pacs');
const pdfHistoria = require('./pdfHistoria');

const ALCANCES = new Set(['pacs_estudio', 'adjunto', 'pdf_atencion']);
const HORAS_DEFAULT = 48;
const HORAS_MAX = 168; // 7 días
const MAX_USOS_DEFAULT = null;

function frontBase() {
  return (config.corsOrigins?.[0] || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function crear(cuenta, idAtencion, body = {}) {
  const alcance = String(body.alcance || '').trim();
  if (!ALCANCES.has(alcance)) throw badRequest('Tipo de recurso no válido', 'ALCANCE_INVALIDO');

  const horas = Math.min(HORAS_MAX, Math.max(1, Number(body.horas) || HORAS_DEFAULT));
  const maxUsos = body.maxUsos == null || body.maxUsos === '' ? MAX_USOS_DEFAULT : Math.max(1, Math.min(50, Number(body.maxUsos) || 1));

  // Valida pertenencia de la atención.
  const det = await atenciones.detalle(cuenta, idAtencion);
  const { _ref } = det;

  let recurso = null;
  const clinica = det.clinica?.nombre || 'Clínica';
  let meta = `${clinica} · ${det.tipoLabel}`;

  if (alcance === 'pdf_atencion') {
    const servicio = det.servicio || det.tipoLabel || 'Atención';
    meta = `Historia clínica · ${servicio} · ${det.fechaIngreso}`;
  } else if (alcance === 'pacs_estudio') {
    const idEst = String(body.recursoId || '');
    const ref = openId(idEst);
    if (!ref || ref.k !== 'pacs' || ref.c !== cuenta.id || ref.e !== _ref.idEmpresa || ref.v !== _ref.numeroVisita || !ref.u) {
      throw notFound('Estudio no encontrado');
    }
    // sealId rota el IV: comparar por UID interno, no por el string opaco.
    const lista = await pacs.listarPorAtencion(cuenta, idAtencion);
    const est = lista.estudios.find((e) => openId(e.id)?.u === ref.u);
    if (!est) throw notFound('Estudio no encontrado');
    recurso = idEst;
    meta = `Estudio de imágenes · ${est.descripcion || 'Sin descripción'}`;
  } else if (alcance === 'adjunto') {
    const idAdj = String(body.recursoId || '');
    const ref = openId(idAdj);
    if (!ref || ref.k !== 'adj' || ref.c !== cuenta.id || ref.e !== _ref.idEmpresa || ref.v !== _ref.numeroVisita || ref.a == null) {
      throw notFound('Adjunto no encontrado');
    }
    const lista = await adjuntos.listar(cuenta, idAtencion);
    const a = lista.adjuntos.find((x) => openId(x.id)?.a === ref.a);
    if (!a) throw notFound('Adjunto no encontrado');
    recurso = idAdj;
    meta = `Adjunto · ${a.nombre}`;
  }

  const token = randomToken(24);
  const expiraEn = new Date(Date.now() + horas * 3_600_000);
  const row = await getRepos().enlaces.crear({
    tokenHash: sha256(token),
    idCuenta: cuenta.id,
    idEmpresa: _ref.idEmpresa,
    numeroVisita: _ref.numeroVisita,
    alcance,
    recurso,
    meta,
    expiraEn,
    maxUsos
  });

  return {
    id: row.id,
    url: `${frontBase()}/c/${token}`,
    expiraEn: expiraEn.toISOString(),
    maxUsos,
    alcance,
    meta,
    _ref
  };
}

async function listarDeAtencion(cuenta, idAtencion) {
  const det = await atenciones.detalle(cuenta, idAtencion);
  const rows = await getRepos().enlaces.listarPorVisita(cuenta.id, det._ref.idEmpresa, det._ref.numeroVisita);
  return {
    enlaces: rows.map((r) => ({
      id: r.id,
      alcance: r.alcance,
      meta: r.meta,
      expiraEn: r.expiraEn instanceof Date ? r.expiraEn.toISOString() : r.expiraEn,
      maxUsos: r.maxUsos,
      usos: r.usos,
      revocado: Boolean(r.revocado),
      creadoEn: r.creadoEn instanceof Date ? r.creadoEn.toISOString() : r.creadoEn
    })),
    _ref: det._ref
  };
}

async function revocar(cuenta, idEnlace) {
  const ok = await getRepos().enlaces.revocar(cuenta.id, Number(idEnlace));
  if (!ok) throw notFound('Enlace no encontrado');
  return { ok: true };
}

async function resolverPublico(tokenRaw) {
  const token = String(tokenRaw || '').trim();
  if (!token || token.length < 16) throw notFound('Enlace no encontrado');
  const row = await getRepos().enlaces.porTokenHash(sha256(token));
  if (!row || row.revocado) throw notFound('Enlace no encontrado');
  const expira = row.expiraEn instanceof Date ? row.expiraEn : new Date(row.expiraEn);
  if (expira.getTime() < Date.now()) throw gone('Este enlace expiró', 'ENLACE_EXPIRADO');
  if (row.maxUsos != null && row.usos >= row.maxUsos) throw gone('Este enlace ya no está disponible', 'ENLACE_AGOTADO');

  const idAtencion = require('../lib/crypto').sealId({ c: row.idCuenta, e: row.idEmpresa, v: row.numeroVisita });
  const base = {
    id: row.id,
    meta: row.meta,
    expiraEn: expira.toISOString(),
    idAtencion,
    cuentaId: row.idCuenta,
    idEmpresa: row.idEmpresa,
    numeroVisita: row.numeroVisita
  };

  if (row.alcance === 'pdf_atencion') return { ...base, tipo: 'pdf_atencion' };
  if (row.alcance === 'pacs_estudio') return { ...base, tipo: 'pacs_estudio', idEstudio: row.recurso };
  return { ...base, tipo: 'adjunto', idAdjunto: row.recurso };
}

async function consumirUso(idEnlace) {
  await getRepos().enlaces.registrarUso(idEnlace);
}

/** Cuenta mínima para reutilizar servicios autenticados en el flujo público. */
async function cuentaDeEnlace(cuentaId) {
  const c = await getRepos().cuentas.porId(cuentaId);
  if (!c) throw notFound('Enlace no encontrado');
  return c;
}

module.exports = { crear, listarDeAtencion, revocar, resolverPublico, consumirUso, cuentaDeEnlace, ALCANCES };
