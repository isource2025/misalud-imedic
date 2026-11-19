// Cache corta en memoria de la línea de tiempo por (cuenta, clínica). Con varias réplicas, cada una tiene la suya.
const { config } = require('../config');

const store = new Map();
const MAX = 2000;

const key = (idCuenta, idEmpresa) => `${idCuenta}:${idEmpresa}`;

function get(idCuenta, idEmpresa) {
  const hit = store.get(key(idCuenta, idEmpresa));
  if (!hit) return null;
  if (Date.now() - hit.at > config.CLINICA_CACHE_SEG * 1000) {
    store.delete(key(idCuenta, idEmpresa));
    return null;
  }
  return hit.data;
}

function set(idCuenta, idEmpresa, data) {
  if (store.size >= MAX) store.delete(store.keys().next().value);
  store.set(key(idCuenta, idEmpresa), { at: Date.now(), data });
}

function invalidarCuenta(idCuenta) {
  for (const k of store.keys()) if (k.startsWith(`${idCuenta}:`)) store.delete(k);
}

module.exports = { get, set, invalidarCuenta };
