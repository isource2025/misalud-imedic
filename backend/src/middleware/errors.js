const logger = require('../lib/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NO_ENCONTRADO', message: 'Recurso inexistente' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: { code: 'SOLICITUD_INVALIDA', message: 'Solicitud inválida' } });
  }
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status === 500) logger.error('error_no_controlado', { path: req.path, code: err.code, message: err.message, stack: err.stack?.split('\n').slice(0, 4).join(' | ') });
  res.status(status).json({
    error: {
      code: err.code || (status === 500 ? 'ERROR_INTERNO' : 'ERROR'),
      message: status === 500 ? 'Ocurrió un error inesperado. Probá de nuevo.' : err.message,
      ...(err.extra || {})
    }
  });
}

module.exports = { notFoundHandler, errorHandler };
