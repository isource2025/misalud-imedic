const test = require('node:test');
const assert = require('node:assert');

const empresas = require('../src/clinicas/empresas');
const source = require('../src/clinicas/source');

const SARMIENTO = { idEmpresa: 101, nombre: 'Sanatorio Sarmiento', seccionesVisibles: ['resumen'] };
const VIDAL = { idEmpresa: 1, nombre: 'Hospital Vidal', seccionesVisibles: ['resumen'] };
const CUENTA = { id: 77, dni: '30111222', sexo: 'M', fechaNacimiento: '1990-05-01', nombreCompleto: 'Juan Perez', identidadVerificadaEn: new Date() };
const FICHA = { idPaciente: 5, dni: '30111222', sexo: 'M', fechaNacimiento: '1990-05-01', nombre: 'PEREZ JUAN' };

let habilitadas = [SARMIENTO];
const consultas = [];
empresas.listarHabilitadas = async () => habilitadas;
source.getClinicSource = () => ({
  buscarPacientesPorDni: async (idEmpresa) => {
    consultas.push(idEmpresa);
    return idEmpresa === VIDAL.idEmpresa ? [FICHA] : [];
  },
  listarAtenciones: async (idEmpresa) => (idEmpresa === VIDAL.idEmpresa ? [{ numeroVisita: 1, fechaIngreso: '2026-01-02', clase: 'A' }] : [])
});
const vinculos = require('../src/services/vinculos');
const atenciones = require('../src/services/atenciones');

test('una clínica habilitada después de validar identidad se busca al listar atenciones', async () => {
  await vinculos.buscar(CUENTA);
  assert.deepEqual(consultas, [101]);

  habilitadas = [SARMIENTO, VIDAL];
  const r = await atenciones.listar(CUENTA);
  assert.deepEqual(consultas, [101, 1]);
  assert.equal(r.atenciones.length, 1);
  assert.equal(r.atenciones[0].clinica.id, 1);

  await atenciones.listar(CUENTA);
  assert.deepEqual(consultas, [101, 1], 'una búsqueda reciente no se repite');
});

test('sin identidad verificada no se busca', async () => {
  const antes = consultas.length;
  await atenciones.listar({ id: 78 });
  assert.equal(consultas.length, antes);
});
