const { getRepos } = require('../repos');
const logger = require('../lib/logger');

/** Registra un evento de auditoría sin bloquear ni romper el request si la escritura falla. */
function auditar(req, { idCuenta, accion, idEmpresa, recurso, resultado = 'ok' }) {
  getRepos()
    .auditoria.registrar({ idCuenta: idCuenta ?? req?.cuenta?.id ?? null, accion, idEmpresa, recurso, ip: req?.ip, resultado })
    .catch((err) => logger.error('auditoria_error', { accion, message: err.message }));
}

module.exports = { auditar };
