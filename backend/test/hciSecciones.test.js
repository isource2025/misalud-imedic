const test = require('node:test');
const assert = require('node:assert');
const { seccionesHci, signosDeControl } = require('../src/clinicas/hciSecciones');

test('agrupa cualquier formulario por prefijo de columna, sin vacíos ni columnas de sistema', () => {
  const r = seccionesHci({
    IdHCIngreso: 9,
    NumeroVisita: 437468,
    IdProfecional: 1053,
    MotivoConsulta: 'control',
    EO_TONO: 'normal',
    EO_BIOMOSCROPIA: 'si',
    EO_FONDODEOJO: '',
    EO_BISHOP_P: '   ',
    'SN _PARESCRANEANOS': 'conservados',
    AC_FC: 0,
    ZZ_NUEVO: 'x',
    IMPRESIONDIAGNOSTICA: 'catarata',
    _Fecha: '2026-05-21'
  });
  assert.deepEqual(r.textos, [{ titulo: 'Impresión diagnóstica', texto: 'catarata' }]);
  assert.deepEqual(r.secciones, [
    { titulo: 'Examen oftalmológico', campos: [{ campo: 'TONO', valor: 'normal' }, { campo: 'BIOMOSCROPIA', valor: 'si' }] },
    { titulo: 'Sistema nervioso', campos: [{ campo: 'PARESCRANEANOS', valor: 'conservados' }] },
    { titulo: 'ZZ', campos: [{ campo: 'NUEVO', valor: 'x' }] }
  ]);
});

test('signos del control asociado a la HC', () => {
  assert.deepEqual(signosDeControl({ Maximo: 120, Minimo: 80, Pulso: 0, Axilar: 36.55 }), [
    { campo: 'Presión arterial', valor: '120/80 mmHg' },
    { campo: 'Temperatura axilar', valor: '36.5 °C' }
  ]);
  assert.deepEqual(signosDeControl(null), []);
});
