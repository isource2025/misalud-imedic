const express = require('express');
const atenciones = require('../services/atenciones');
const vinculos = require('../services/vinculos');
const { auditar } = require('../services/audit');
const { requireAuth, requireIdentidad } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const rl = require('../middleware/rateLimit');
const s = require('./schemas');
const { asyncHandler } = require('../lib/errors');

const router = express.Router();
router.use(requireAuth, requireIdentidad);

router.get(
  '/atenciones',
  validate(s.filtrosAtenciones, 'query'),
  asyncHandler(async (req, res) => {
    const r = await atenciones.listar(req.cuenta, req.validQuery);
    auditar(req, { accion: 'atenciones_listar', resultado: r.clinicasNoDisponibles.length ? 'parcial' : 'ok' });
    res.set('Cache-Control', 'no-store').json(r);
  })
);

router.get(
  '/atenciones/:id',
  asyncHandler(async (req, res) => {
    try {
      const { _ref, ...detalle } = await atenciones.detalle(req.cuenta, req.params.id);
      auditar(req, { accion: 'atencion_ver', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
      res.set('Cache-Control', 'no-store').json(detalle);
    } catch (err) {
      auditar(req, { accion: 'atencion_ver', resultado: err.status === 404 ? 'denegado' : 'error' });
      throw err;
    }
  })
);

router.get(
  '/vinculos',
  asyncHandler(async (req, res) => res.set('Cache-Control', 'no-store').json({ clinicas: await vinculos.resumen(req.cuenta) }))
);

router.post(
  '/vinculos/buscar',
  rl.vinculosDni,
  asyncHandler(async (req, res) => {
    const resultado = await vinculos.buscar(req.cuenta, { auditar: (e) => auditar(req, e) });
    res.json({ resultado, clinicas: await vinculos.resumen(req.cuenta) });
  })
);

module.exports = router;
