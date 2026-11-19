#!/usr/bin/env node
// Verificación de adjuntos en producción. Correr DENTRO del contenedor del backend (usa sus variables):
//   node scripts/verificar-adjuntos.js            (clínicas 1, 101 y 103)
//   node scripts/verificar-adjuntos.js 101        (una sola)
// Imprime solo conteos, estados HTTP, tamaños y tiempos: nunca nombres, rutas, DNI ni ids de pacientes/visitas.
// Los archivos de prueba se leen y se descartan en memoria. No escribe en ninguna base.
const { config } = require('../src/config');
const { listarHabilitadas } = require('../src/clinicas/empresas');
const mssqlSource = require('../src/clinicas/mssqlSource');
const { pedirAClinica } = require('../src/clinicas/clinicaHttp');
const { clinicKeyFor } = require('../src/lib/signedFileToken');
const { getPortalPool, closePortalPool } = require('../src/db/portalDb');
const { confirmadosPorEmpresa } = require('../src/services/vinculos');
const adjuntos = require('../src/services/adjuntos');
const { sealId } = require('../src/lib/crypto');

const EMPRESAS = process.argv.slice(2).map(Number).filter(Boolean);
const OBJETIVO = EMPRESAS.length ? EMPRESAS : [1, 101, 103];
const TABLAS = ['imVisita', 'imPedidosEstudiosAdjuntos', 'hctiposimagenes'];

const linea = (...p) => console.log(p.join(' '));
const ms = (t0) => `${Date.now() - t0}ms`;

async function contarBytes(body) {
  let n = 0;
  for await (const chunk of body) n += chunk.length;
  return n;
}

async function verificarClinica(empresa) {
  const id = empresa.idEmpresa;
  linea(`\n== Clínica ${id} (${empresa.nombre})`);
  linea(`  secciones: adjuntos=${empresa.seccionesVisibles.includes('adjuntos') ? 'sí' : 'NO'}`);
  linea(`  file server configurado: ${empresa.fileServerUrl ? 'sí' : 'NO'} | clave de firma: ${clinicKeyFor('fs', id) ? 'sí' : 'no (pedidos sin firma)'}`);

  try {
    const t0 = Date.now();
    const r = await pedirAClinica({ servicio: 'fs', idEmpresa: id, ruta: '/health', timeoutMs: 8000 });
    const h = await r.json().catch(() => ({}));
    linea(`  file server /health: HTTP ${r.status} encoding=${h.encoding || '?'} auth=${h.auth || '?'} security=${h.security || '-'} (${ms(t0)})`);
  } catch (err) {
    linea(`  file server /health: ERROR ${err.code || err.message}`);
  }

  let pool;
  try {
    pool = await mssqlSource.getPool(id);
  } catch (err) {
    linea(`  SQL: no conecta (${err.code || err.message})`);
    return { id, sql: false };
  }
  const permisos = {};
  for (const t of TABLAS) {
    const r = await pool.request().input('o', `dbo.${t}`).query("SELECT ISNULL(HAS_PERMS_BY_NAME(@o, 'OBJECT', 'SELECT'), 0) AS ok");
    permisos[t] = Number(r.recordset[0].ok) === 1;
  }
  linea(`  SELECT de ${config.CLINICA_DB_USER_DEFAULT}: ${TABLAS.map((t) => `${t}=${permisos[t] ? 'OK' : 'NO'}`).join(' ')}`);
  if (!permisos.imPedidosEstudiosAdjuntos) return { id, sql: true, grants: false };

  const total = await pool.request().query(`
    SELECT COUNT(*) AS n,
           SUM(CASE WHEN NULLIF(LTRIM(RTRIM(CAST(PatchServidor AS NVARCHAR(1000)))), '') IS NULL THEN 1 ELSE 0 END) AS sinRuta
    FROM dbo.imPedidosEstudiosAdjuntos`);
  linea(`  adjuntos en la clínica: ${total.recordset[0].n} (sin PatchServidor: ${total.recordset[0].sinRuta})`);

  // Muestra: los 3 adjuntos más recientes con ruta, bajados por el mismo camino que usa el proxy y descartados.
  const muestra = await pool.request().query(`
    SELECT TOP 3 CAST(PatchServidor AS NVARCHAR(1000)) AS Ruta
    FROM dbo.imPedidosEstudiosAdjuntos
    WHERE NULLIF(LTRIM(RTRIM(CAST(PatchServidor AS NVARCHAR(1000)))), '') IS NOT NULL
    ORDER BY IdAdjunto DESC`);
  let ok = 0;
  for (const [i, fila] of muestra.recordset.entries()) {
    const t0 = Date.now();
    try {
      const r = await mssqlSource.abrirArchivoAdjunto(id, fila.Ruta, { timeoutMs: 25000 });
      const bytes = r.status === 200 ? await contarBytes(r.body) : (await r.body?.cancel().catch(() => {}), 0);
      if (r.status === 200 && bytes > 0) ok += 1;
      linea(`  muestra ${i + 1}: HTTP ${r.status} ${bytes} bytes ${r.headers.get('content-type') || ''} (${ms(t0)})`);
    } catch (err) {
      linea(`  muestra ${i + 1}: ERROR ${err.code || err.message} (${ms(t0)})`);
    }
  }
  return { id, sql: true, grants: true, muestraOk: ok, muestra: muestra.recordset.length };
}

/** Recorrido completo del proxy (pertenencia + listado + descarga) con las cuentas reales vinculadas del portal. */
async function verificarCuentas(ids) {
  linea('\n== Cuentas del portal (servicio de adjuntos, mismo código que GET /api/adjuntos/:id/archivo)');
  const pool = await getPortalPool();
  const cuentas = (
    await pool.request().query("SELECT DISTINCT TOP 200 IdCuenta FROM dbo.Vinculos WHERE Estado = 'confirmado'")
  ).recordset.map((r) => Number(r.IdCuenta));
  const res = { cuentas: cuentas.length, atencionesConAdjuntos: 0, listados: 0, descargasOk: 0, descargasError: 0, ajenoBloqueado: 0 };
  let otra = null;
  for (const idCuenta of cuentas) {
    const vinc = await confirmadosPorEmpresa(idCuenta);
    for (const [idEmpresa, idsPaciente] of vinc) {
      if (!ids.includes(idEmpresa)) continue;
      let visitas = [];
      try {
        visitas = await mssqlSource.listarAtenciones(idEmpresa, idsPaciente);
      } catch {
        continue;
      }
      for (const v of visitas.filter((x) => x.cantAdjuntos > 0).slice(0, 2)) {
        res.atencionesConAdjuntos += 1;
        const cuenta = { id: idCuenta };
        const lista = await adjuntos.listar(cuenta, sealId({ c: idCuenta, e: idEmpresa, v: v.numeroVisita })).catch(() => null);
        if (!lista?.adjuntos.length) continue;
        res.listados += lista.adjuntos.length;
        try {
          const t0 = Date.now();
          const a = await adjuntos.abrir(cuenta, lista.adjuntos[0].id);
          const bytes = await contarBytes(a.res.body);
          res.descargasOk += bytes > 0 ? 1 : 0;
          linea(`  clínica ${idEmpresa}: atención con ${lista.adjuntos.length} adjunto(s), descarga ${bytes} bytes ${a.headers['Content-Type']} (${ms(t0)})`);
        } catch (err) {
          res.descargasError += 1;
          linea(`  clínica ${idEmpresa}: descarga ERROR ${err.code || err.status}`);
        }
        if (otra != null && otra !== idCuenta) {
          await adjuntos.abrir({ id: otra }, lista.adjuntos[0].id).catch((err) => {
            if (err.status === 404) res.ajenoBloqueado += 1;
          });
        }
      }
    }
    otra = idCuenta;
  }
  linea(`  resumen: ${JSON.stringify(res)}`);
}

(async () => {
  if (config.MOCK_MODE) throw new Error('Correr con MOCK_MODE=false, dentro del contenedor del backend.');
  const habilitadas = await listarHabilitadas();
  const resultados = [];
  for (const id of OBJETIVO) {
    const e = habilitadas.find((x) => x.idEmpresa === id);
    if (!e) {
      linea(`\n== Clínica ${id}: no está habilitada en EmpresasPortal`);
      continue;
    }
    resultados.push(await verificarClinica(e).catch((err) => (linea(`  ERROR ${err.code || err.message}`), { id })));
  }
  await verificarCuentas(OBJETIVO).catch((err) => linea(`  ERROR ${err.code || err.message}`));
  linea(`\nResumen clínicas: ${JSON.stringify(resultados)}`);
})()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePortalPool().catch(() => {});
    setTimeout(() => process.exit(), 200).unref();
  });
