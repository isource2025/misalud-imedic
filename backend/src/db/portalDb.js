const sql = require('mssql');
const { config } = require('../config');
const logger = require('../lib/logger');

let poolPromise = null;

function getPortalPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool({
      server: config.PORTAL_DB_SERVER,
      port: config.PORTAL_DB_PORT,
      database: config.PORTAL_DB_NAME,
      user: config.PORTAL_DB_USER,
      password: config.PORTAL_DB_PASSWORD,
      pool: { max: 10, min: 1, idleTimeoutMillis: 30_000 },
      options: { encrypt: config.PORTAL_DB_ENCRYPT, trustServerCertificate: config.PORTAL_DB_TRUST_CERT }
    });
    pool.on('error', (err) => logger.error('portal_db_error', { code: err.code }));
    poolPromise = pool.connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function closePortalPool() {
  if (!poolPromise) return;
  const pool = await poolPromise.catch(() => null);
  poolPromise = null;
  if (pool) await pool.close();
}

module.exports = { sql, getPortalPool, closePortalPool };
