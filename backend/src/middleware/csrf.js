// CSRF por doble envío (cookie ms_csrf legible + header x-csrf-token) y chequeo de Origin.
// Complementa SameSite=Strict de las cookies de sesión.
const { config } = require('../config');
const { COOKIE_CSRF } = require('../services/sessions');
const { safeEqual } = require('../lib/crypto');
const { forbidden } = require('../lib/errors');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !config.corsOrigins.includes(origin.replace(/\/$/, ''))) {
    return next(forbidden('Origen no permitido', 'ORIGEN_INVALIDO'));
  }
  const cookie = req.cookies?.[COOKIE_CSRF];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(forbidden('Token CSRF inválido. Recargá la página.', 'CSRF_INVALIDO'));
  }
  next();
}

module.exports = { csrfProtection };
