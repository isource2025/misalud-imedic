const sessions = require('../services/sessions');
const { getRepos } = require('../repos');
const { unauthorized, forbidden, asyncHandler } = require('../lib/errors');

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[sessions.COOKIE_AT];
  const payload = token && sessions.verificarAccess(token);
  if (!payload) throw unauthorized();
  if (!(await sessions.validarSesion(payload.sid, payload.idCuenta))) {
    sessions.clearCookies(res);
    throw unauthorized('Tu sesión venció. Ingresá de nuevo.', 'SESION_VENCIDA');
  }
  const cuenta = await getRepos().cuentas.porId(payload.idCuenta);
  if (!cuenta || cuenta.estado !== 'activa') throw unauthorized();
  req.cuenta = cuenta;
  req.sesion = { sid: payload.sid };
  next();
});

/** Los datos clínicos exigen email verificado e identidad validada. */
const requireIdentidad = (req, res, next) => {
  if (!req.cuenta?.emailVerificadoEn) return next(forbidden('Verificá tu email para continuar.', 'EMAIL_NO_VERIFICADO'));
  if (!req.cuenta?.identidadVerificadaEn) return next(forbidden('Validá tu identidad para ver tu información clínica.', 'IDENTIDAD_NO_VERIFICADA'));
  next();
};

module.exports = { requireAuth, requireIdentidad };
