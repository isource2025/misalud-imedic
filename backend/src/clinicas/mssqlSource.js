// Lectura directa del SQL Server de cada clínica con el login de SOLO LECTURA misalud_portal_ro (script S4 de
// iMedic SaaS: rol misalud_lectura, SELECT sobre una lista cerrada de tablas). Las consultas reimplementan,
// acotadas, las de iMedic SaaS (admissionSearch, hcIngreso y epicrisis services).
// Ubicación: catálogo vw_MiSaludEmpresas (DbServer/DbPort/DbInstance/DbName) o CLINICA_<ID>_DB_SERVER/_PORT/
// _INSTANCE/_NAME, que lo pisan. Credenciales SOLO por entorno: CLINICA_<ID>_DB_PASSWORD (+ _USER, default
// misalud_portal_ro; opcionales _ENCRYPT, _TRUST_CERT).
// Las tablas que el rol no puede leer (imPassword, imPersonal, imSectores; imHCI hasta que S4 la incluya) se
// detectan con HAS_PERMS_BY_NAME y se omiten en vez de romper la consulta.
const sql = require('mssql');
const { config } = require('../config');
const logger = require('../lib/logger');
const { toIsoDate } = require('../lib/clarion');
const { normalizeDni, normalizeSexo } = require('../lib/text');
const { obtenerHabilitada } = require('./empresas');

const pools = new Map();
const columnCache = new Map();
const permisoCache = new Map();

async function connectionConfig(idEmpresa) {
  const p = (k) => process.env[`CLINICA_${idEmpresa}_DB_${k}`];
  const db = (await obtenerHabilitada(idEmpresa))?.db || {};
  const server = p('SERVER') || db.server;
  const database = p('NAME') || db.database;
  if (!server || !database || !p('PASSWORD')) {
    const err = new Error(`Sin ubicación o credenciales SQL para la clínica ${idEmpresa}`);
    err.code = 'CLINICA_SIN_CREDENCIALES';
    throw err;
  }
  const instanceName = p('INSTANCE') || db.instance || undefined;
  const port = Number(p('PORT') || db.port) || undefined;
  return {
    server,
    port: instanceName && !port ? undefined : port || 1433,
    database,
    user: p('USER') || config.CLINICA_DB_USER_DEFAULT,
    password: p('PASSWORD'),
    connectionTimeout: 7000,
    requestTimeout: 8000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 60_000 },
    options: {
      encrypt: /^(1|true)$/i.test(p('ENCRYPT') || 'false'),
      trustServerCertificate: /^(1|true)$/i.test(p('TRUST_CERT') || 'true'),
      instanceName,
      readOnlyIntent: true
    }
  };
}

function getPool(idEmpresa) {
  if (!pools.has(idEmpresa)) {
    const promise = connectionConfig(idEmpresa)
      .then((cfg) => {
        const pool = new sql.ConnectionPool(cfg);
        pool.on('error', (err) => logger.warn('clinica_pool_error', { idEmpresa, code: err.code }));
        return pool.connect();
      })
      .catch((err) => {
        pools.delete(idEmpresa);
        throw err;
      });
    pools.set(idEmpresa, promise);
  }
  return pools.get(idEmpresa);
}

async function puedeLeer(idEmpresa, tabla) {
  const key = `${idEmpresa}:${tabla}`;
  if (permisoCache.has(key)) return permisoCache.get(key);
  const pool = await getPool(idEmpresa);
  const r = await pool
    .request()
    .input('o', sql.NVarChar(256), `dbo.${tabla}`)
    .query(`SELECT ISNULL(HAS_PERMS_BY_NAME(@o, 'OBJECT', 'SELECT'), 0) AS ok`);
  const ok = Number(r.recordset[0]?.ok) === 1;
  if (!ok) logger.warn('clinica_tabla_sin_permiso', { idEmpresa, tabla });
  permisoCache.set(key, ok);
  return ok;
}

async function tieneColumna(idEmpresa, tabla, columna) {
  const key = `${idEmpresa}:${tabla}.${columna}`;
  if (columnCache.has(key)) return columnCache.get(key);
  const pool = await getPool(idEmpresa);
  const r = await pool
    .request()
    .input('t', sql.NVarChar(128), tabla)
    .input('c', sql.NVarChar(128), columna)
    .query(`SELECT TOP 1 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t AND COLUMN_NAME = @c`);
  const ok = r.recordset.length > 0;
  columnCache.set(key, ok);
  return ok;
}

function inList(request, ids, prefix = 'id') {
  return ids
    .map((id, i) => {
      request.input(`${prefix}${i}`, sql.Int, id);
      return `@${prefix}${i}`;
    })
    .join(', ');
}

async function buscarPacientesPorDni(idEmpresa, dni) {
  const pool = await getPool(idEmpresa);
  const r = await pool
    .request()
    .input('dni', sql.VarChar(20), normalizeDni(dni))
    .query(`
      SELECT TOP 20
        p.IDPaciente,
        LTRIM(RTRIM(CAST(p.NumeroDocumento AS VARCHAR(30)))) AS NumeroDocumento,
        LTRIM(RTRIM(ISNULL(p.ApellidoyNombre, ''))) AS ApellidoyNombre,
        LTRIM(RTRIM(CAST(p.Sexo AS VARCHAR(10)))) AS SexoValor,
        LTRIM(RTRIM(ISNULL(sx.Descripcion, ''))) AS SexoDescripcion,
        p.FechaNacimiento
      FROM dbo.imPacientes p
      LEFT JOIN dbo.imSexo sx ON sx.Valor = p.Sexo
      WHERE REPLACE(REPLACE(LTRIM(RTRIM(CAST(p.NumeroDocumento AS VARCHAR(30)))), '.', ''), ' ', '') = @dni
    `);
  return r.recordset.map((x) => ({
    idPaciente: Number(x.IDPaciente),
    dni: normalizeDni(x.NumeroDocumento),
    nombre: x.ApellidoyNombre,
    sexo: normalizeSexo(x.SexoDescripcion) || normalizeSexo(x.SexoValor),
    fechaNacimiento: toIsoDate(x.FechaNacimiento)
  }));
}

async function selectVisita(idEmpresa) {
  const conSucursal = (await tieneColumna(idEmpresa, 'imVisita', 'IdSucursal')) && (await puedeLeer(idEmpresa, 'Sucursales'));
  return {
    centroSelect: conSucursal
      ? `LTRIM(RTRIM(ISNULL(suc.Descripcion, ''))) AS Centro`
      : `CAST('' AS VARCHAR(200)) AS Centro`,
    centroJoin: conSucursal ? 'LEFT JOIN dbo.Sucursales suc ON v.IdSucursal = suc.IdSucursal' : '',
    base: `
      v.NUMEROVISITA AS NumeroVisita,
      v.IDPACIENTE AS IdPaciente,
      CONVERT(VARCHAR(10), v.FECHAADMISIONS, 23) AS FechaIngreso,
      CONVERT(VARCHAR(5), v.FECHAADMISIONS, 108) AS HoraIngreso,
      v.FechaEgreso AS FechaEgresoClarion,
      UPPER(LEFT(LTRIM(RTRIM(COALESCE(v.ClasePaciente, ''))), 1)) AS Clase,
      LTRIM(RTRIM(ISNULL(sm.Descripcion, ''))) AS Servicio,
      LTRIM(RTRIM(ISNULL(v.Diagnostico, ''))) AS DiagnosticoCodigo,
      LTRIM(RTRIM(ISNULL(d.Descripcion, ''))) AS DiagnosticoDescripcion`,
    joins: `
      OUTER APPLY (
        SELECT TOP 1 d0.Descripcion FROM dbo.imDiagnosticos d0
        WHERE LTRIM(RTRIM(ISNULL(v.Diagnostico, ''))) <> ''
          AND LTRIM(RTRIM(ISNULL(d0.CodigoOMS, ''))) = LTRIM(RTRIM(v.Diagnostico))
      ) d
      OUTER APPLY (
        SELECT TOP 1 s0.Descripcion FROM dbo.imServiciosMedicos s0
        WHERE LTRIM(RTRIM(ISNULL(v.ServicioHospital, ''))) NOT IN ('', '0')
          AND LTRIM(RTRIM(ISNULL(s0.Valor, ''))) = LTRIM(RTRIM(v.ServicioHospital))
      ) sm`
  };
}

const mapVisita = (x) => ({
  numeroVisita: Number(x.NumeroVisita),
  fechaIngreso: x.FechaIngreso,
  horaIngreso: x.HoraIngreso,
  fechaEgreso: toIsoDate(x.FechaEgresoClarion),
  clase: x.Clase || '',
  servicio: x.Servicio || null,
  centro: x.Centro || null,
  diagnostico: x.DiagnosticoCodigo ? { codigo: x.DiagnosticoCodigo, descripcion: x.DiagnosticoDescripcion || null } : null,
  tieneHcIngreso: Boolean(x.TieneHci),
  tieneEpicrisis: Boolean(x.TieneEpicrisis)
});

async function listarAtenciones(idEmpresa, idsPaciente) {
  if (!idsPaciente.length) return [];
  const pool = await getPool(idEmpresa);
  const s = await selectVisita(idEmpresa);
  const conHci = await puedeLeer(idEmpresa, 'imHCI');
  const request = pool.request();
  const ids = inList(request, idsPaciente);
  const r = await request.query(`
    SELECT TOP 300 ${s.base}, ${s.centroSelect},
      ${conHci ? 'CASE WHEN EXISTS (SELECT 1 FROM dbo.imHCI h WHERE h.NumeroVisita = v.NUMEROVISITA) THEN 1 ELSE 0 END' : '0'} AS TieneHci,
      CASE WHEN EXISTS (SELECT 1 FROM dbo.imHCEpicrisis e WHERE e.IdVisita = v.NUMEROVISITA) THEN 1 ELSE 0 END AS TieneEpicrisis
    FROM dbo.imVisita v
    ${s.joins}
    ${s.centroJoin}
    WHERE v.IDPACIENTE IN (${ids})
    ORDER BY v.FECHAADMISIONS DESC, v.NUMEROVISITA DESC
  `);
  return r.recordset.map(mapVisita);
}

async function detalleAtencion(idEmpresa, numeroVisita, idsPaciente) {
  if (!idsPaciente.length) return null;
  const pool = await getPool(idEmpresa);
  const s = await selectVisita(idEmpresa);
  const request = pool.request().input('nv', sql.Int, numeroVisita);
  const ids = inList(request, idsPaciente);
  const visita = await request.query(`
    SELECT TOP 1 ${s.base}, ${s.centroSelect},
      LTRIM(RTRIM(ISNULL(v.DIAGNOSTICOEGRESO, ''))) AS DiagnosticoEgresoCodigo,
      LTRIM(RTRIM(ISNULL(dEgr.Descripcion, ''))) AS DiagnosticoEgresoDescripcion
    FROM dbo.imVisita v
    ${s.joins}
    OUTER APPLY (
      SELECT TOP 1 d1.Descripcion FROM dbo.imDiagnosticos d1
      WHERE LTRIM(RTRIM(ISNULL(v.DIAGNOSTICOEGRESO, ''))) <> ''
        AND LTRIM(RTRIM(ISNULL(d1.CodigoOMS, ''))) = LTRIM(RTRIM(v.DIAGNOSTICOEGRESO))
    ) dEgr
    ${s.centroJoin}
    WHERE v.NUMEROVISITA = @nv AND v.IDPACIENTE IN (${ids})
  `);
  const row = visita.recordset[0];
  if (!row) return null;

  const [conHci, conPassword, conPersonal, conSectores] = await Promise.all(
    ['imHCI', 'imPassword', 'imPersonal', 'imSectores'].map((t) => puedeLeer(idEmpresa, t))
  );
  const sectorSelect = () =>
    conSectores ? `LTRIM(RTRIM(ISNULL(sec.Descripcion, ''))) AS Sector` : `CAST('' AS VARCHAR(200)) AS Sector`;
  const sectorJoin = (alias) => (conSectores ? `LEFT JOIN dbo.imSectores sec ON ${alias}.IdSector = sec.Valor` : '');

  const [hci, epi] = await Promise.all([
    !conHci ? { recordset: [] } : pool.request().input('nv', sql.Int, numeroVisita).query(`
      SELECT TOP 20
        CONVERT(VARCHAR(10), hc.Fecha, 23) AS Fecha,
        SUBSTRING(CONVERT(VARCHAR(8), hc.Fecha, 108), 1, 5) AS Hora,
        CAST(hc.MotivoConsulta AS NVARCHAR(MAX)) AS MotivoConsulta,
        CAST(hc.EnfermedadActual AS NVARCHAR(MAX)) AS EnfermedadActual,
        ${sectorSelect()},
        ${conPassword ? `LTRIM(RTRIM(ISNULL(pw.Apellido, '') + ' ' + ISNULL(pw.Nombres, '')))` : `CAST('' AS VARCHAR(200))`} AS Profesional
      FROM dbo.imHCI hc
      ${conPassword ? 'LEFT JOIN dbo.imPassword pw ON pw.CodOperador = hc.IdProfecional' : ''}
      ${sectorJoin('hc')}
      WHERE hc.NumeroVisita = @nv
      ORDER BY hc.Fecha DESC`),
    pool.request().input('nv', sql.Int, numeroVisita).query(`
      SELECT TOP 20
        CONVERT(VARCHAR(10), ep.Fecha, 23) AS Fecha,
        CONVERT(VARCHAR(5), DATEADD(ms, (ISNULL(ep.Hora, 1) - 1) * 10, 0), 108) AS Hora,
        ep.Epicrisis,
        RTRIM(LTRIM(ISNULL(ep.Diagnostico, ''))) AS Diagnostico,
        ep.DiagnosticoText,
        dx.Descripcion AS DiagnosticoDescripcion,
        ${conPersonal ? `LTRIM(RTRIM(ISNULL(per.ApellidoNombre, '')))` : `CAST('' AS VARCHAR(200))`} AS Profesional,
        ${sectorSelect()}
      FROM dbo.imHCEpicrisis ep
      ${conPersonal ? 'LEFT JOIN dbo.imPersonal per ON per.Valor = ep.Profecional' : ''}
      ${sectorJoin('ep')}
      OUTER APPLY (
        SELECT TOP 1 LTRIM(RTRIM(d0.Descripcion)) AS Descripcion FROM dbo.imDiagnosticos d0
        WHERE LTRIM(RTRIM(ISNULL(ep.Diagnostico, ''))) <> ''
          AND REPLACE(UPPER(LTRIM(RTRIM(ISNULL(d0.CodigoOMS, '')))), '.', '') = REPLACE(UPPER(LTRIM(RTRIM(ep.Diagnostico))), '.', '')
      ) dx
      WHERE ep.IdVisita = @nv
      ORDER BY ep.Fecha DESC, ep.Hora DESC`)
  ]);

  return {
    ...mapVisita({ ...row, TieneHci: hci.recordset.length, TieneEpicrisis: epi.recordset.length }),
    diagnosticoEgreso: row.DiagnosticoEgresoCodigo
      ? { codigo: row.DiagnosticoEgresoCodigo, descripcion: row.DiagnosticoEgresoDescripcion || null }
      : null,
    hcIngreso: hci.recordset.map((h) => ({
      fecha: h.Fecha,
      hora: h.Hora,
      motivoConsulta: h.MotivoConsulta || null,
      enfermedadActual: h.EnfermedadActual || null,
      profesional: h.Profesional || null,
      sector: h.Sector || null
    })),
    epicrisis: epi.recordset.map((e) => ({
      fecha: e.Fecha,
      hora: e.Hora,
      texto: e.Epicrisis || null,
      diagnostico: e.Diagnostico
        ? { codigo: e.Diagnostico, descripcion: e.DiagnosticoDescripcion || e.DiagnosticoText || null }
        : e.DiagnosticoText
          ? { codigo: null, descripcion: e.DiagnosticoText }
          : null,
      profesional: e.Profesional || null,
      sector: e.Sector || null
    }))
  };
}

module.exports = { buscarPacientesPorDni, listarAtenciones, detalleAtencion };
