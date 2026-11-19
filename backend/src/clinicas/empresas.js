// Qué clínicas están habilitadas para el portal y dónde están sus servicios.
// - EMPRESAS_SOURCE=portal: solo la tabla EmpresasPortal de la base del portal (Habilitada = 1); la ubicación
//   del SQL Server de cada clínica sale de CLINICA_<ID>_DB_*.
// - EMPRESAS_SOURCE=imedic: además lee la vista vw_MiSaludEmpresas del MySQL de plataforma de iMedic SaaS con el
//   usuario misalud_catalogo_ro (solo SELECT sobre esa vista; nunca la tabla Empresas). La vista aporta nombre,
//   servidor/base SQL (sin usuario ni contraseña), FileServerUrl y PacsUrl. Habilitada sigue siendo
//   EmpresasPortal; si la vista llega a exponer PortalHabilitado, también se exige.
// El catálogo vive solo en memoria: no se copia a la base del portal.
const { config } = require('../config');
const { getRepos } = require('../repos');
const logger = require('../lib/logger');

const SECCIONES_DEFAULT = ['resumen', 'hcIngreso', 'diagnostico', 'epicrisis'];
const VISTA_CATALOGO = 'vw_MiSaludEmpresas';
const CACHE_MS = 60_000;
let cache = { at: 0, data: null };
let mysqlPool = null;

const texto = (v) => {
  const s = v == null ? '' : String(v).trim();
  return s || null;
};

function mapearFilaCatalogo(r) {
  const habilitadoEnImedic = 'PortalHabilitado' in r ? Boolean(Number(r.PortalHabilitado)) : true;
  return {
    idEmpresa: Number(r.IDEMPRESA),
    descripcion: texto(r.DESCRIPCION),
    habilitadoEnImedic,
    db: {
      server: texto(r.DbServer),
      port: Number(r.DbPort) || null,
      instance: texto(r.DbInstance),
      database: texto(r.DbName)
    },
    fileServerUrl: texto(r.FileServerUrl),
    pacsUrl: texto(r.PacsUrl)
  };
}

async function leerCatalogoImedic() {
  if (!mysqlPool) {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: config.CATALOGO_DB_HOST,
      port: config.CATALOGO_DB_PORT,
      database: config.CATALOGO_DB_NAME,
      user: config.CATALOGO_DB_USER,
      password: config.CATALOGO_DB_PASSWORD,
      ssl: config.CATALOGO_DB_SSL ? { rejectUnauthorized: true } : undefined,
      connectionLimit: 2,
      connectTimeout: 7000
    });
  }
  // SELECT * es intencional: la vista ya es una lista cerrada de columnas y puede omitir las que no existan.
  const [rows] = await mysqlPool.query(`SELECT * FROM \`${VISTA_CATALOGO}\``);
  return rows.map(mapearFilaCatalogo).filter((e) => Number.isFinite(e.idEmpresa));
}

function armar(local, catalogo) {
  return {
    idEmpresa: local.idEmpresa,
    nombre: local.nombreVisible || catalogo?.descripcion || `Clínica ${local.idEmpresa}`,
    seccionesVisibles: local.seccionesVisibles?.length ? local.seccionesVisibles : SECCIONES_DEFAULT,
    demoraPublicacionHoras: local.demoraPublicacionHoras ?? 0,
    db: catalogo?.db || null,
    fileServerUrl: process.env[`CLINICA_${local.idEmpresa}_FILE_SERVER_URL`] || catalogo?.fileServerUrl || null,
    pacsUrl: process.env[`CLINICA_${local.idEmpresa}_PACS_URL`] || catalogo?.pacsUrl || null
  };
}

async function cargar() {
  const locales = (await getRepos().empresas.listar()).filter((e) => e.habilitada);

  if (config.EMPRESAS_SOURCE === 'imedic' && !config.MOCK_MODE) {
    const catalogo = new Map((await leerCatalogoImedic()).map((e) => [e.idEmpresa, e]));
    return locales
      .filter((l) => {
        const c = catalogo.get(l.idEmpresa);
        if (!c) logger.warn('empresa_fuera_de_catalogo', { idEmpresa: l.idEmpresa });
        return c?.habilitadoEnImedic;
      })
      .map((l) => armar(l, catalogo.get(l.idEmpresa)));
  }

  return locales.map((l) => armar(l, null));
}

async function listarHabilitadas() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const data = await cargar();
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    logger.error('empresas_habilitadas_error', { code: err.code, message: err.message });
    if (cache.data) return cache.data;
    throw err;
  }
}

async function obtenerHabilitada(idEmpresa) {
  return (await listarHabilitadas()).find((e) => e.idEmpresa === Number(idEmpresa)) || null;
}

function invalidarCache() {
  cache = { at: 0, data: null };
}

module.exports = { listarHabilitadas, obtenerHabilitada, invalidarCache, mapearFilaCatalogo, SECCIONES_DEFAULT, VISTA_CATALOGO };
