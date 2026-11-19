// Qué clínicas están habilitadas para el portal.
// - EMPRESAS_SOURCE=portal: tabla EmpresasPortal de la base del portal (Habilitada = 1).
// - EMPRESAS_SOURCE=imedic: flag Empresas.PortalHabilitado del catálogo MySQL de iMedic SaaS (lo administra el
//   super admin de iMedic); EmpresasPortal aporta solo la configuración (secciones visibles, demora).
const { config } = require('../config');
const { getRepos } = require('../repos');
const logger = require('../lib/logger');

const SECCIONES_DEFAULT = ['resumen', 'hcIngreso', 'diagnostico', 'epicrisis'];
const CACHE_MS = 60_000;
let cache = { at: 0, data: null };
let mysqlPool = null;

async function leerCatalogoImedic() {
  if (!mysqlPool) {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({ uri: config.IMEDIC_CATALOG_URL, connectionLimit: 2 });
  }
  const [rows] = await mysqlPool.query(
    'SELECT IDEMPRESA AS idEmpresa, DESCRIPCION AS descripcion FROM Empresas WHERE PortalHabilitado = 1'
  );
  return rows.map((r) => ({ idEmpresa: Number(r.idEmpresa), descripcion: r.descripcion }));
}

async function cargar() {
  const locales = await getRepos().empresas.listar();
  const porId = new Map(locales.map((e) => [e.idEmpresa, e]));

  if (config.EMPRESAS_SOURCE === 'imedic' && !config.MOCK_MODE) {
    const catalogo = await leerCatalogoImedic();
    return catalogo.map(({ idEmpresa, descripcion }) => {
      const local = porId.get(idEmpresa);
      return {
        idEmpresa,
        nombre: local?.nombreVisible || descripcion,
        seccionesVisibles: local?.seccionesVisibles?.length ? local.seccionesVisibles : SECCIONES_DEFAULT,
        demoraPublicacionHoras: local?.demoraPublicacionHoras ?? 0
      };
    });
  }

  return locales
    .filter((e) => e.habilitada)
    .map((e) => ({
      idEmpresa: e.idEmpresa,
      nombre: e.nombreVisible,
      seccionesVisibles: e.seccionesVisibles?.length ? e.seccionesVisibles : SECCIONES_DEFAULT,
      demoraPublicacionHoras: e.demoraPublicacionHoras ?? 0
    }));
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

function invalidarCache() {
  cache = { at: 0, data: null };
}

module.exports = { listarHabilitadas, invalidarCache, SECCIONES_DEFAULT };
