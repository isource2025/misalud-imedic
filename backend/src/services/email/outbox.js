// Cola de salida (tabla EmailsSalida): el request solo encola; un worker envía con reintentos y backoff.
const { getRepos } = require('../../repos');
const engine = require('./engine');
const { render } = require('./templates');
const logger = require('../../lib/logger');

const MAX_INTENTOS = 5;
let timer = null;
let corriendo = false;

async function encolar(para, plantilla, datos) {
  const id = await getRepos().emails.encolar({ para, plantilla, datos });
  setImmediate(() => procesar().catch(() => {}));
  return id;
}

async function procesar() {
  if (corriendo) return;
  corriendo = true;
  try {
    const repos = getRepos();
    const pendientes = await repos.emails.tomarPendientes(10);
    for (const email of pendientes) {
      try {
        const msg = render(email.plantilla, email.datos || {});
        await engine.send({ to: email.para, ...msg });
        await repos.emails.marcarEnviado(email.id);
      } catch (err) {
        const intentos = (email.intentos || 0) + 1;
        const fallido = err.fatal || intentos >= MAX_INTENTOS;
        const backoffSeg = Math.min(15 * 2 ** intentos, 1800);
        await repos.emails.marcarError(email.id, {
          error: `${err.code || 'ERROR'}: ${err.message}`,
          proximoIntentoEn: new Date(Date.now() + backoffSeg * 1000),
          fallido
        });
        logger.warn('email_envio_fallo', { id: email.id, plantilla: email.plantilla, code: err.code, intentos, fallido });
      }
    }
  } finally {
    corriendo = false;
  }
}

function iniciarWorker(intervaloMs = 5000) {
  if (timer) return;
  timer = setInterval(() => procesar().catch((err) => logger.error('outbox_error', { message: err.message })), intervaloMs);
  timer.unref();
}

function detenerWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { encolar, procesar, iniciarWorker, detenerWorker };
