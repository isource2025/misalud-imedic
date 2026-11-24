// Rate limit por IP y por DNI. Store en memoria: con varias réplicas, pasar a Redis (rate-limit-redis).
const { rateLimit } = require('express-rate-limit');
const { normalizeDni } = require('../lib/text');

const handler = (req, res) =>
  res.status(429).json({ error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' } });

const porIp = (limit, minutos) =>
  rateLimit({ windowMs: minutos * 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false, handler });

const porDni = (limit, minutos) =>
  rateLimit({
    windowMs: minutos * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
    skip: (req) => !normalizeDni(req.body?.dni) && !req.cuenta,
    keyGenerator: (req) => `dni:${normalizeDni(req.body?.dni) || req.cuenta?.dni}`
  });

const porCuenta = (limit, minutos) =>
  rateLimit({
    windowMs: minutos * 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
    skip: (req) => !req.cuenta,
    keyGenerator: (req) => `cuenta:${req.cuenta.id}`
  });

/** Streaming de DICOM / adjuntos: no cuenta contra el cupo general (son cientos de GETs por estudio). */
const esStreamClinico = (req) =>
  /\/pacs\/archivos\/|\/adjuntos\/[^/]+\/archivo|\/c\/[^/]+\/archivo\//.test(String(req.originalUrl || req.url || ''));

module.exports = {
  adjuntosCuenta: porCuenta(400, 15),
  // Un TAC puede pedir 200–700 .dcm; el cupo tiene que bancar una sesión de visor.
  pacsCuenta: porCuenta(4000, 15),
  pdfCuenta: porCuenta(30, 15),
  compartirCuenta: porCuenta(40, 60),
  compartirPublico: porIp(4000, 15),
  general: rateLimit({
    windowMs: 5 * 60_000,
    limit: 800,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
    skip: esStreamClinico
  }),
  loginIp: porIp(30, 15),
  loginDni: porDni(8, 15),
  registroIp: porIp(10, 60),
  codigoIp: porIp(20, 15),
  codigoDni: porDni(5, 15),
  passwordDni: porDni(5, 60),
  identidadDni: porDni(5, 60),
  vinculosDni: porDni(6, 60)
};
