// Lectura directa del SQL Server de cada clínica con un usuario de SOLO LECTURA (decisión D3 del plan).
// Las consultas reimplementan, acotadas, las de iMedic SaaS (admissionSearch, hcIngreso y epicrisis services).
// Credenciales por variables de entorno: CLINICA_<IdEmpresa>_DB_SERVER / _PORT / _NAME / _USER / _PASSWORD
// (+ opcionales _INSTANCE, _ENCRYPT, _TRUST_CERT).
const sql = require('mssql');
const logger = require('../lib/logger');
const { toIsoDate } = require('../lib/clarion');
const { normalizeDni, normalizeSexo } = require('../lib/text');

const pools = new Map();
const columnCache = new Map();

function connectionConfig(idEmpresa) {
  const p = (k) => process.env[`CLINICA_${idEmpresa}_DB_${k}`];
  if (!p('SERVER') || !p('USER') || !p('PASSWORD') || !p('NAME')) {
    const err = new Error(`Sin credenciales SQL para la clínica ${idEmpresa}`);
    err.code = 'CLINICA_SIN_CREDENCIALES';
    throw err;
  }
  return {
    server: p('SERVER'),
    port: Number(p('PORT') || 1433),
    database: p('NAME'),
    user: p('USER'),
    password: p('PASSWORD'),
    connectionTimeout: 7000,
    requestTimeout: 8000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 60_000 },
    options: {
      encrypt: /^(1|true)$/i.test(p('ENCRYPT') || 'false'),
      trustServerCertificate: /^(1|true)$/i.test(p('TRUST_CERT') || 'true'),
      instanceName: p('INSTANCE') || undefined,
      readOnlyIntent: true
    }
  };
}

function getPool(idEmpresa) {
  if (!pools.has(idEmpresa)) {
    const pool = new sql.ConnectionPool(connectionConfig(idEmpresa));
    pool.on('error', (err) => logger.warn('clinica_pool_error', { idEmpresa, code: err.code }));
    const promise = pool.connect().catch((err) => {
      pools.delete(idEmpresa);
      throw err;
    });
    pools.set(idEmpresa, promise);
  }
  return pools.get(idEmpresa);
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
  const conSucursal = await tieneColumna(idEmpresa, 'imVisita', 'IdSucursal');
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
  const request = pool.request();
  const ids = inList(request, idsPaciente);
  const r = await request.query(`
    SELECT TOP 300 ${s.base}, ${s.centroSelect},
      CASE WHEN EXISTS (SELECT 1 FROM dbo.imHCI h WHERE h.NumeroVisita = v.NUMEROVISITA) THEN 1 ELSE 0 END AS TieneHci,
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

  const [hci, epi] = await Promise.all([
    pool.request().input('nv', sql.Int, numeroVisita).query(`
      SELECT TOP 20
        CONVERT(VARCHAR(10), hc.Fecha, 23) AS Fecha,
        SUBSTRING(CONVERT(VARCHAR(8), hc.Fecha, 108), 1, 5) AS Hora,
        CAST(hc.MotivoConsulta AS NVARCHAR(MAX)) AS MotivoConsulta,
        CAST(hc.EnfermedadActual AS NVARCHAR(MAX)) AS EnfermedadActual,
        LTRIM(RTRIM(ISNULL(sec.Descripcion, ''))) AS Sector,
        LTRIM(RTRIM(ISNULL(pw.Apellido, '') + ' ' + ISNULL(pw.Nombres, ''))) AS Profesional
      FROM dbo.imHCI hc
      LEFT JOIN dbo.imPassword pw ON pw.CodOperador = hc.IdProfecional
      LEFT JOIN dbo.imSectores sec ON hc.IdSector = sec.Valor
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
        LTRIM(RTRIM(ISNULL(per.ApellidoNombre, ''))) AS Profesional,
        LTRIM(RTRIM(ISNULL(sec.Descripcion, ''))) AS Sector
      FROM dbo.imHCEpicrisis ep
      LEFT JOIN dbo.imPersonal per ON per.Valor = ep.Profecional
      LEFT JOIN dbo.imSectores sec ON ep.IdSector = sec.Valor
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
