// Índice DNI → (clínica, IDPaciente). Reglas de la sección 3 del plan para el DNI no único.
const { getRepos } = require('../repos');
const { listarHabilitadas } = require('../clinicas/empresas');
const { getClinicSource, conTimeout } = require('../clinicas/source');
const { nameSimilarity, normalizeDni } = require('../lib/text');
const atencionesCache = require('./atencionesCache');
const logger = require('../lib/logger');

/** Evalúa una ficha de imPacientes contra la cuenta verificada. */
function evaluarCandidato(cuenta, ficha) {
  const sim = nameSimilarity(cuenta.nombreCompleto, ficha.nombre);
  const puntaje = Math.round(40 + (ficha.sexo === cuenta.sexo ? 20 : 0) + (ficha.fechaNacimiento === cuenta.fechaNacimiento ? 25 : 0) + 15 * sim);

  if (normalizeDni(ficha.dni) !== normalizeDni(cuenta.dni)) return { estado: 'descartado', puntaje: 0, motivo: 'DNI distinto' };

  const faltaSexo = !ficha.sexo || !cuenta.sexo || cuenta.sexo === 'X';
  const faltaFecha = !ficha.fechaNacimiento || !cuenta.fechaNacimiento;

  if (!faltaSexo && ficha.sexo !== cuenta.sexo) return { estado: 'descartado', puntaje, motivo: 'Sexo no coincide' };
  if (!faltaFecha && ficha.fechaNacimiento !== cuenta.fechaNacimiento) {
    return { estado: 'descartado', puntaje, motivo: 'Fecha de nacimiento no coincide' };
  }
  if (faltaSexo || faltaFecha) {
    return sim >= 0.5
      ? { estado: 'pendiente', puntaje, motivo: faltaFecha ? 'Ficha sin fecha de nacimiento' : 'Ficha sin sexo' }
      : { estado: 'descartado', puntaje, motivo: 'Datos incompletos y nombre distinto' };
  }
  if (sim < 0.2) return { estado: 'pendiente', puntaje, motivo: 'DNI, sexo y fecha coinciden pero el nombre no' };
  return { estado: 'confirmado', puntaje, motivo: 'DNI, sexo y fecha de nacimiento coinciden' };
}

/** Recorre las clínicas habilitadas buscando fichas del DNI de la cuenta y actualiza los vínculos. */
async function buscar(cuenta, { auditar } = {}) {
  if (!cuenta.identidadVerificadaEn) throw new Error('La cuenta no tiene identidad verificada');
  const empresas = await listarHabilitadas();
  const source = getClinicSource();
  const repos = getRepos();

  const resultados = await Promise.allSettled(
    empresas.map(async (empresa) => {
      const fichas = await conTimeout(source.buscarPacientesPorDni(empresa.idEmpresa, cuenta.dni));
      const conteo = { confirmado: 0, pendiente: 0, descartado: 0 };
      for (const ficha of fichas) {
        const ev = evaluarCandidato(cuenta, ficha);
        conteo[ev.estado] += 1;
        const v = await repos.vinculos.upsert({ idCuenta: cuenta.id, idEmpresa: empresa.idEmpresa, idPaciente: ficha.idPaciente, ...ev });
        if (v.cambio && auditar) auditar({ accion: `vinculo_${ev.estado}`, idEmpresa: empresa.idEmpresa, recurso: `vinculo:${v.id}` });
      }
      return conteo;
    })
  );

  atencionesCache.invalidarCuenta(cuenta.id);

  return empresas.map((empresa, i) => {
    const r = resultados[i];
    if (r.status === 'rejected') {
      logger.warn('vinculos_clinica_no_disponible', { idEmpresa: empresa.idEmpresa, code: r.reason?.code });
      return { id: empresa.idEmpresa, nombre: empresa.nombre, disponible: false };
    }
    return { id: empresa.idEmpresa, nombre: empresa.nombre, disponible: true, ...r.value };
  });
}

/** Vínculos de la cuenta agrupados por clínica, sin exponer IDPaciente. */
async function resumen(cuenta) {
  const [vinculos, empresas] = await Promise.all([getRepos().vinculos.listarPorCuenta(cuenta.id), listarHabilitadas()]);
  return empresas.map((e) => {
    const propios = vinculos.filter((v) => v.idEmpresa === e.idEmpresa);
    const confirmados = propios.filter((v) => v.estado === 'confirmado').length;
    const pendientes = propios.filter((v) => v.estado === 'pendiente').length;
    return {
      id: e.idEmpresa,
      nombre: e.nombre,
      estado: confirmados ? 'vinculada' : pendientes ? 'pendiente' : 'sin_registros',
      fichasConfirmadas: confirmados,
      fichasPendientes: pendientes,
      verificadoEn: propios.find((v) => v.verificadoEn)?.verificadoEn || null
    };
  });
}

/** Mapa idEmpresa → IDPaciente[] confirmados (lo único que habilita leer datos clínicos). */
async function confirmadosPorEmpresa(idCuenta) {
  const vinculos = await getRepos().vinculos.listarPorCuenta(idCuenta);
  const map = new Map();
  for (const v of vinculos) {
    if (v.estado !== 'confirmado') continue;
    if (!map.has(v.idEmpresa)) map.set(v.idEmpresa, []);
    map.get(v.idEmpresa).push(v.idPaciente);
  }
  return map;
}

module.exports = { evaluarCandidato, buscar, resumen, confirmadosPorEmpresa };
