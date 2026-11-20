// Endpoints públicos de un link temporal (sin sesión). El token opaco es el secreto.
const express = require('express');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const compartir = require('../services/compartir');
const pacs = require('../services/pacs');
const adjuntos = require('../services/adjuntos');
const pdfHistoria = require('../services/pdfHistoria');
const { auditar } = require('../services/audit');
const { asyncHandler } = require('../lib/errors');
const logger = require('../lib/logger');
const rl = require('../middleware/rateLimit');

const router = express.Router();

router.get(
  '/:token',
  rl.compartirPublico,
  asyncHandler(async (req, res) => {
    const link = await compartir.resolverPublico(req.params.token);
    auditar(req, {
      accion: 'enlace_abrir',
      idEmpresa: link.idEmpresa,
      recurso: `visita:${link.numeroVisita}`,
      resultado: 'ok'
    });
    res.set('Cache-Control', 'no-store').json({
      tipo: link.tipo,
      meta: link.meta,
      expiraEn: link.expiraEn,
      tieneArchivo: true
    });
  })
);

router.get(
  '/:token/contenido',
  rl.compartirPublico,
  asyncHandler(async (req, res) => {
    const link = await compartir.resolverPublico(req.params.token);
    const cuenta = await compartir.cuentaDeEnlace(link.cuentaId);
    await compartir.consumirUso(link.id);

    if (link.tipo === 'pdf_atencion') {
      const { buffer, nombre, _ref } = await pdfHistoria.generarBuffer(cuenta, link.idAtencion);
      auditar(req, { accion: 'enlace_pdf', idEmpresa: _ref.idEmpresa, recurso: `visita:${_ref.numeroVisita}` });
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}"`,
        'Cache-Control': 'private, no-store'
      });
      return res.send(buffer);
    }

    if (link.tipo === 'adjunto') {
      const abierto = await adjuntos.abrir(cuenta, link.idAdjunto, { descargar: false });
      const { res: origen, headers, _ref } = abierto;
      auditar(req, {
        accion: 'enlace_adjunto',
        idEmpresa: _ref.idEmpresa,
        recurso: `visita:${_ref.numeroVisita}/adjunto:${_ref.idAdjunto}`
      });
      res.status(200).set(headers);
      const cuerpo = Readable.fromWeb(origen.body);
      req.on('close', () => cuerpo.destroy());
      return pipeline(cuerpo, res).catch((err) => {
        if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') logger.warn('enlace_adjunto_stream', { code: err.code });
      });
    }

    // pacs_estudio: lista archivos del estudio (JSON). El .dcm se pide por id opaco con el mismo token.
    const archivos = await pacs.listarArchivos(cuenta, link.idEstudio);
    const series = await pacs.listarSeries(cuenta, link.idEstudio);
    auditar(req, {
      accion: 'enlace_pacs',
      idEmpresa: archivos._ref.idEmpresa,
      recurso: `visita:${archivos._ref.numeroVisita}`
    });
    res.set('Cache-Control', 'no-store').json({
      meta: link.meta,
      series: series.series,
      archivos: archivos.archivos
    });
  })
);

router.get(
  '/:token/archivo/:idArchivo',
  rl.compartirPublico,
  asyncHandler(async (req, res) => {
    const link = await compartir.resolverPublico(req.params.token);
    if (link.tipo !== 'pacs_estudio') {
      const err = new Error('Enlace no encontrado');
      err.status = 404;
      throw err;
    }
    const cuenta = await compartir.cuentaDeEnlace(link.cuentaId);
    const abierto = await pacs.abrirArchivo(cuenta, req.params.idArchivo);
    // Solo archivos del estudio compartido.
    if (abierto._ref.uid !== require('../lib/crypto').openId(link.idEstudio)?.u) {
      const err = new Error('Archivo no encontrado');
      err.status = 404;
      throw err;
    }
    await compartir.consumirUso(link.id);
    const { res: origen, headers, _ref } = abierto;
    auditar(req, {
      accion: 'enlace_pacs_archivo',
      idEmpresa: _ref.idEmpresa,
      recurso: `visita:${_ref.numeroVisita}`
    });
    res.status(200).set(headers);
    const cuerpo = Readable.fromWeb(origen.body);
    req.on('close', () => cuerpo.destroy());
    pipeline(cuerpo, res).catch((err) => {
      if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') logger.warn('enlace_pacs_stream', { code: err.code });
    });
  })
);

module.exports = router;
