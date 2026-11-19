const express = require('express');
const auth = require('../services/auth');
const sessions = require('../services/sessions');
const { auditar } = require('../services/audit');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const rl = require('../middleware/rateLimit');
const s = require('./schemas');
const { asyncHandler, unauthorized } = require('../lib/errors');

const router = express.Router();
const auditor = (req) => (evento) => auditar(req, evento);

router.get('/csrf', (req, res) => {
  const token = req.cookies?.[sessions.COOKIE_CSRF] || sessions.setCsrfCookie(res);
  res.json({ csrfToken: token });
});

router.post(
  '/registro',
  rl.registroIp,
  validate(s.registro),
  rl.codigoDni,
  asyncHandler(async (req, res) => {
    const r = await auth.registrar(req.body);
    auditar(req, { accion: 'registro' });
    res.status(202).json(r);
  })
);

router.post(
  '/email/enviar-codigo',
  rl.codigoIp,
  validate(s.soloDni),
  rl.codigoDni,
  asyncHandler(async (req, res) => res.json(await auth.reenviarCodigoEmail(req.body.dni)))
);

router.post(
  '/email/verificar',
  rl.codigoIp,
  validate(s.verificarEmail),
  rl.codigoDni,
  asyncHandler(async (req, res) => {
    const cuenta = await auth.verificarEmail(req.body.dni, req.body.codigo);
    await sessions.crear(res, cuenta.id, req);
    auditar(req, { idCuenta: cuenta.id, accion: 'email_verificado' });
    res.json({ cuenta: auth.cuentaPublica(cuenta) });
  })
);

router.post(
  '/login',
  rl.loginIp,
  validate(s.login),
  rl.loginDni,
  asyncHandler(async (req, res) => {
    let r;
    try {
      r = await auth.login(req.body.dni, req.body.password);
    } catch (err) {
      auditar(req, { accion: 'login', resultado: 'fallido' });
      throw err;
    }
    if (r.requiereVerificacionEmail) {
      return res.json({ requiereVerificacionEmail: true, emailEnmascarado: r.emailEnmascarado, ...(r.codigoDemo ? { codigoDemo: r.codigoDemo } : {}) });
    }
    await sessions.crear(res, r.cuenta.id, req);
    auditar(req, { idCuenta: r.cuenta.id, accion: 'login' });
    res.json({ cuenta: auth.cuentaPublica(r.cuenta) });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await sessions.cerrar(req, res);
    res.json({ ok: true });
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const idCuenta = await sessions.refrescar(req, res);
    if (!idCuenta) {
      sessions.clearCookies(res);
      throw unauthorized('Tu sesión venció. Ingresá de nuevo.', 'SESION_VENCIDA');
    }
    res.json({ ok: true });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ cuenta: auth.cuentaPublica(req.cuenta) }));

router.post(
  '/identidad/verificar',
  requireAuth,
  rl.identidadDni,
  validate(s.identidad),
  asyncHandler(async (req, res) => {
    const r = await auth.verificarIdentidad(req.cuenta, req.body, { auditar: auditor(req) });
    res.json({ cuenta: auth.cuentaPublica(r.cuenta), clinicas: r.clinicas });
  })
);

router.post(
  '/password/olvide',
  rl.codigoIp,
  validate(s.soloDni),
  rl.passwordDni,
  asyncHandler(async (req, res) => {
    auditar(req, { accion: 'password_olvide' });
    res.json(await auth.olvidePassword(req.body.dni));
  })
);

router.post(
  '/password/reset',
  rl.codigoIp,
  validate(s.reset),
  rl.codigoDni,
  asyncHandler(async (req, res) => {
    await auth.resetPassword(req.body.dni, req.body.codigo, req.body.password);
    auditar(req, { accion: 'password_reset' });
    res.json({ ok: true });
  })
);

router.put(
  '/password',
  requireAuth,
  rl.passwordDni,
  validate(s.cambiarPassword),
  asyncHandler(async (req, res) => {
    await auth.cambiarPassword(req.cuenta, req.body.actual, req.body.nueva);
    auditar(req, { accion: 'password_cambio' });
    sessions.clearCookies(res);
    res.json({ ok: true, reingresar: true });
  })
);

router.put(
  '/contacto',
  requireAuth,
  validate(s.contacto),
  asyncHandler(async (req, res) => {
    const cuenta = await auth.actualizarContacto(req.cuenta, { telefono: req.body.telefono || null });
    auditar(req, { accion: 'contacto_actualizado' });
    res.json({ cuenta: auth.cuentaPublica(cuenta) });
  })
);

module.exports = router;
