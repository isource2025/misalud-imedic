// Sesión: access token JWT corto (cookie ms_at) + refresh token opaco rotativo (cookie ms_rt, guardado como hash).
// Vence tras SESSION_IDLE_MIN minutos sin actividad o SESSION_MAX_HOURS desde el login.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { getRepos } = require('../repos');
const { randomToken, sha256, safeEqual } = require('../lib/crypto');

const AUDIENCE = 'misalud:portal';
const ISSUER = 'misalud-back';
const COOKIE_AT = 'ms_at';
const COOKIE_RT = 'ms_rt';
const COOKIE_CSRF = 'ms_csrf';

const baseCookie = () => ({ httpOnly: true, secure: config.isProd, sameSite: 'strict' });

function firmarAccess(idCuenta, sid) {
  return jwt.sign({ sid }, config.secrets.sessionJwt, {
    algorithm: 'HS256',
    subject: String(idCuenta),
    audience: AUDIENCE,
    issuer: ISSUER,
    expiresIn: `${config.ACCESS_TOKEN_MIN}m`
  });
}

function verificarAccess(token) {
  try {
    const p = jwt.verify(token, config.secrets.sessionJwt, { algorithms: ['HS256'], audience: AUDIENCE, issuer: ISSUER });
    return { idCuenta: Number(p.sub), sid: p.sid };
  } catch {
    return null;
  }
}

function setCookies(res, { access, refresh }) {
  res.cookie(COOKIE_AT, access, { ...baseCookie(), path: '/', maxAge: config.ACCESS_TOKEN_MIN * 60_000 });
  res.cookie(COOKIE_RT, refresh, { ...baseCookie(), path: '/api/auth', maxAge: config.SESSION_MAX_HOURS * 3_600_000 });
  setCsrfCookie(res);
}

function setCsrfCookie(res, token = randomToken(24)) {
  res.cookie(COOKIE_CSRF, token, { httpOnly: false, secure: config.isProd, sameSite: 'strict', path: '/' });
  return token;
}

function clearCookies(res) {
  res.clearCookie(COOKIE_AT, { ...baseCookie(), path: '/' });
  res.clearCookie(COOKIE_RT, { ...baseCookie(), path: '/api/auth' });
}

async function crear(res, idCuenta, req) {
  const sid = crypto.randomUUID();
  const refreshSecret = randomToken();
  const ahora = new Date();
  await getRepos().sesiones.crear({
    id: sid,
    idCuenta,
    refreshHash: sha256(refreshSecret),
    ultimaActividad: ahora,
    expiraEn: new Date(ahora.getTime() + config.SESSION_MAX_HOURS * 3_600_000),
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  setCookies(res, { access: firmarAccess(idCuenta, sid), refresh: `${sid}.${refreshSecret}` });
  return sid;
}

const inactiva = (s) => Date.now() - new Date(s.ultimaActividad).getTime() > config.SESSION_IDLE_MIN * 60_000;

/** Valida que la sesión del access token siga viva (permite revocación inmediata). */
async function validarSesion(sid, idCuenta) {
  const repos = getRepos();
  const s = await repos.sesiones.porId(sid);
  if (!s || s.revocada || s.idCuenta !== idCuenta || new Date(s.expiraEn) < new Date() || inactiva(s)) return false;
  if (Date.now() - new Date(s.ultimaActividad).getTime() > 60_000) await repos.sesiones.tocar(sid, new Date());
  return true;
}

async function refrescar(req, res) {
  const raw = req.cookies?.[COOKIE_RT] || '';
  const [sid, secret] = raw.split('.');
  if (!sid || !secret) return null;
  const repos = getRepos();
  const s = await repos.sesiones.porId(sid);
  if (!s || s.revocada || new Date(s.expiraEn) < new Date()) return null;
  if (!safeEqual(s.refreshHash, sha256(secret))) {
    // Reuso de un refresh ya rotado: posible robo. Se revoca la sesión.
    await repos.sesiones.revocar(sid);
    return null;
  }
  if (inactiva(s)) {
    await repos.sesiones.revocar(sid);
    return null;
  }
  const nuevo = randomToken();
  await repos.sesiones.rotar(sid, sha256(nuevo), new Date());
  setCookies(res, { access: firmarAccess(s.idCuenta, sid), refresh: `${sid}.${nuevo}` });
  return s.idCuenta;
}

async function cerrar(req, res) {
  const raw = req.cookies?.[COOKIE_RT] || '';
  const sid = req.sesion?.sid || raw.split('.')[0];
  if (sid) await getRepos().sesiones.revocar(sid).catch(() => {});
  clearCookies(res);
}

module.exports = {
  crear,
  refrescar,
  cerrar,
  verificarAccess,
  validarSesion,
  setCsrfCookie,
  clearCookies,
  COOKIE_AT,
  COOKIE_RT,
  COOKIE_CSRF
};
