const { config } = require('../config');

let source = null;

function getClinicSource() {
  if (!source) source = config.MOCK_MODE ? require('./mockSource') : require('./mssqlSource');
  return source;
}

/** Ejecuta una consulta a una clínica con timeout propio; nunca deja colgado el fan-out. */
function conTimeout(promise, ms = config.CLINICA_TIMEOUT_MS) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Timeout de clínica'), { code: 'CLINICA_TIMEOUT' })), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

module.exports = { getClinicSource, conTimeout };
