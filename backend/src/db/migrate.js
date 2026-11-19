#!/usr/bin/env node
// Aplica en orden los archivos de db/migrations que todavía no figuran en dbo.SchemaMigraciones.
const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const { getPortalPool, closePortalPool, sql } = require('./portalDb');

const DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

const splitBatches = (text) =>
  text
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter(Boolean);

async function migrate() {
  if (config.MOCK_MODE) {
    console.log('MOCK_MODE=true: no hay base para migrar (se usa almacenamiento en memoria).');
    return;
  }
  const pool = await getPortalPool();
  await pool.request().batch(`
    IF OBJECT_ID('dbo.SchemaMigraciones') IS NULL
      CREATE TABLE dbo.SchemaMigraciones (
        Nombre NVARCHAR(200) NOT NULL PRIMARY KEY,
        AplicadaEn DATETIME2(0) NOT NULL DEFAULT (SYSUTCDATETIME())
      );
  `);
  const applied = new Set(
    (await pool.request().query('SELECT Nombre FROM dbo.SchemaMigraciones')).recordset.map((r) => r.Nombre)
  );
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const batch of splitBatches(fs.readFileSync(path.join(DIR, file), 'utf8'))) {
        await new sql.Request(tx).batch(batch);
      }
      await new sql.Request(tx).input('n', sql.NVarChar(200), file).query(
        'INSERT INTO dbo.SchemaMigraciones (Nombre) VALUES (@n)'
      );
      await tx.commit();
      console.log(`✔ ${file}`);
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw new Error(`Falló ${file}: ${err.message}`);
    }
  }
  console.log('Migraciones al día.');
}

if (require.main === module) {
  migrate()
    .then(() => closePortalPool())
    .catch(async (err) => {
      console.error(err.message);
      await closePortalPool();
      process.exit(1);
    });
}

module.exports = { migrate, splitBatches };
