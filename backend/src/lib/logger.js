// Logs en JSON de una línea. Nunca loguear bodies, contraseñas, códigos, DNI ni emails.
const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel = levels[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'test' ? levels.error : levels.info);

function write(level, msg, meta) {
  if (levels[level] < minLevel) return;
  const line = { t: new Date().toISOString(), level, msg, ...(meta || {}) };
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  out.write(`${JSON.stringify(line)}\n`);
}

module.exports = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta)
};
