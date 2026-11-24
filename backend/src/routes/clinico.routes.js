const express = require('express');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const atenciones = require('../services/atenciones');
const adjuntos = require('../services/adjuntos');
const pacs = require('../services/pacs');
const pdfHistoria = require('../services/pdfHistoria');
const compartir = require('../services/compartir');
const logger = require('../lib/logger');
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
  '/atenciones/:id/adjuntos',
  asyncHandler(async (req, res) => {
    try {
      const { _ref, ...r } = await adjuntos.listar(req.cuenta, req.params.id);
      auditar(req, { accion: 'adjuntos_listar', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
      res.set('Cache-Control', 'no-store').json(r);
    } catch (err) {
      auditar(req, { accion: 'adjuntos_listar', resultado: err.status === 404 ? 'denegado' : 'error' });
      throw err;
    }
  })
);

router.get(
  '/adjuntos/:id/disponible',
  rl.adjuntosCuenta,
  asyncHandler(async (req, res) => {
    const { _ref, ...r } = await adjuntos.disponible(req.cuenta, req.params.id);
    res.set('Cache-Control', 'no-store').json(r);
  })
);

router.get(
  '/adjuntos/:id/archivo',
  rl.adjuntosCuenta,
  asyncHandler(async (req, res) => {
    const descargar = req.query.descargar === '1';
    const accion = descargar ? 'adjunto_descargar' : 'adjunto_ver';
    let abierto;
    try {
      abierto = await adjuntos.abrir(req.cuenta, req.params.id, { descargar });
    } catch (err) {
      auditar(req, { accion, resultado: err.status === 404 ? 'denegado' : 'error' });
      throw err;
    }
    const { res: origen, headers, _ref } = abierto;
    auditar(req, { accion, idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}/adjunto:${_ref.idAdjunto}` });
    res.status(200).set(headers);
    const cuerpo = Readable.fromWeb(origen.body);
    req.on('close', () => cuerpo.destroy());
    pipeline(cuerpo, res).catch((err) => {
      if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') logger.warn('adjunto_stream_error', { idEmpresa: _ref.idEmpresa, code: err.code });
    });
  })
);

router.get(
  '/atenciones/:id/pacs',
  asyncHandler(async (req, res) => {
    try {
      const { _ref, ...r } = await pacs.listarPorAtencion(req.cuenta, req.params.id);
      auditar(req, { accion: 'pacs_listar', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
      res.set('Cache-Control', 'no-store').json(r);
    } catch (err) {
      auditar(req, { accion: 'pacs_listar', resultado: err.status === 404 ? 'denegado' : 'error' });
      throw err;
    }
  })
);

router.get(
  '/pacs/estudios/:id/series',
  rl.pacsCuenta,
  asyncHandler(async (req, res) => {
    const { _ref, ...r } = await pacs.listarSeries(req.cuenta, req.params.id);
    auditar(req, { accion: 'pacs_series', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
    res.set('Cache-Control', 'no-store').json(r);
  })
);

router.get(
  '/pacs/estudios/:id/archivos',
  rl.pacsCuenta,
  asyncHandler(async (req, res) => {
    const series = await pacs.listarSeries(req.cuenta, req.params.id);
    const { _ref, ...r } = await pacs.listarArchivos(req.cuenta, req.params.id, {
      seriesIds: series.series.map((s) => s.id)
    });
    auditar(req, { accion: 'pacs_archivos', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
    res.set('Cache-Control', 'no-store').json(r);
  })
);

router.get(
  '/pacs/estudios/:id/disponible',
  rl.pacsCuenta,
  asyncHandler(async (req, res) => {
    const { _ref, ...r } = await pacs.disponible(req.cuenta, req.params.id);
    res.set('Cache-Control', 'no-store').json(r);
  })
);

router.get(
  '/pacs/archivos/:id',
  rl.pacsCuenta,
  asyncHandler(async (req, res) => {
    let abierto;
    try {
      abierto = await pacs.abrirArchivo(req.cuenta, req.params.id);
    } catch (err) {
      auditar(req, { accion: 'pacs_archivo', resultado: err.status === 404 ? 'denegado' : 'error' });
      throw err;
    }
    const { res: origen, headers, _ref } = abierto;
    auditar(req, { accion: 'pacs_archivo', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
    res.status(200).set(headers);
    const cuerpo = Readable.fromWeb(origen.body);
    req.on('close', () => cuerpo.destroy());
    pipeline(cuerpo, res).catch((err) => {
      if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') logger.warn('pacs_stream_error', { idEmpresa: _ref.idEmpresa, code: err.code });
    });
  })
);

router.get(
  '/atenciones/:id/pdf',
  rl.pdfCuenta,
  asyncHandler(async (req, res) => {
    try {
      const { buffer, nombre, _ref } = await pdfHistoria.generarBuffer(req.cuenta, req.params.id);
      auditar(req, { accion: 'pdf_historia', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'private, no-store'
      });
      res.send(buffer);
    } catch (err) {
      auditar(req, { accion: 'pdf_historia', resultado: err.status === 404 ? 'denegado' : 'error' });
      throw err;
    }
  })
);

router.post(
  '/atenciones/:id/compartir',
  rl.compartirCuenta,
  validate(s.compartir, 'body'),
  asyncHandler(async (req, res) => {
    const { _ref, ...r } = await compartir.crear(req.cuenta, req.params.id, req.body);
    auditar(req, { accion: 'enlace_crear', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
    res.status(201).json(r);
  })
);

router.get(
  '/atenciones/:id/compartidos',
  asyncHandler(async (req, res) => {
    const { _ref, ...r } = await compartir.listarDeAtencion(req.cuenta, req.params.id);
    auditar(req, { accion: 'enlaces_listar', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
    res.set('Cache-Control', 'no-store').json(r);
  })
);

router.delete(
  '/compartidos/:id',
  rl.compartirCuenta,
  asyncHandler(async (req, res) => {
    await compartir.revocar(req.cuenta, req.params.id);
    auditar(req, { accion: 'enlace_revocar', resultado: 'ok' });
    res.json({ ok: true });
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
