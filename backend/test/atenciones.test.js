const test = require('node:test');
const assert = require('node:assert');

const empresas = require('../src/clinicas/empresas');
const source = require('../src/clinicas/source');
const vinculos = require('../src/services/vinculos');

const CLINICA = { idEmpresa: 101, nombre: 'Sanatorio Sarmiento', seccionesVisibles: ['resumen'] };
const VISITA = { numeroVisita: 7, fechaIngreso: '2026-11-18', clase: 'A', tieneHcIngreso: false, tieneEpicrisis: false };

let respuestas = [];
let llamadas = 0;
empresas.listarHabilitadas = async () => [CLINICA];
vinculos.confirmadosPorEmpresa = async () => new Map([[101, [1]]]);
source.getClinicSource = () => ({
  listarAtenciones: async () => {
    llamadas += 1;
    const r = respuestas.shift();
    if (r instanceof Error) throw r;
    return r;
  }
});
const atenciones = require('../src/services/atenciones');
const cache = require('../src/services/atencionesCache');

test.beforeEach(() => {
  cache.invalidarCuenta(1);
  llamadas = 0;
});

test('un resultado vacío no se cachea: la próxima consulta ve la atención nueva', async () => {
  respuestas = [[], [VISITA]];
  assert.equal((await atenciones.listar({ id: 1 })).atenciones.length, 0);
  assert.equal((await atenciones.listar({ id: 1 })).atenciones.length, 1);
  assert.equal(llamadas, 2);
});

test('una clínica caída no se cachea como vacía', async () => {
  respuestas = [Object.assign(new Error('Timeout de clínica'), { code: 'CLINICA_TIMEOUT' }), [VISITA]];
  const caida = await atenciones.listar({ id: 1 });
  assert.equal(caida.clinicasNoDisponibles.length, 1);
  assert.equal(caida.atenciones.length, 0);
  assert.equal((await atenciones.listar({ id: 1 })).atenciones.length, 1);
});

test('un resultado con datos sí se cachea', async () => {
  respuestas = [[VISITA]];
  await atenciones.listar({ id: 1 });
  assert.equal((await atenciones.listar({ id: 1 })).atenciones.length, 1);
  assert.equal(llamadas, 1);
});
