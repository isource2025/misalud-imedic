const test = require('node:test');
const assert = require('node:assert');
const { evaluarCandidato } = require('../src/services/vinculos');

const cuenta = { dni: '30123456', sexo: 'F', fechaNacimiento: '1985-04-12', nombreCompleto: 'María Laura Gómez' };

test('DNI + sexo + fecha coinciden → confirmado', () => {
  const r = evaluarCandidato(cuenta, { dni: '30123456', sexo: 'F', fechaNacimiento: '1985-04-12', nombre: 'GOMEZ, MARIA LAURA' });
  assert.equal(r.estado, 'confirmado');
});

test('sexo distinto → descartado', () => {
  const r = evaluarCandidato(cuenta, { dni: '30123456', sexo: 'M', fechaNacimiento: '1950-01-30', nombre: 'GOMEZ JUAN CARLOS' });
  assert.equal(r.estado, 'descartado');
});

test('fecha distinta → descartado', () => {
  const r = evaluarCandidato(cuenta, { dni: '30123456', sexo: 'F', fechaNacimiento: '1990-01-01', nombre: 'GOMEZ MARIA LAURA' });
  assert.equal(r.estado, 'descartado');
});

test('ficha sin fecha y nombre parecido → pendiente', () => {
  const r = evaluarCandidato(cuenta, { dni: '30123456', sexo: 'F', fechaNacimiento: null, nombre: 'GOMEZ MARIA' });
  assert.equal(r.estado, 'pendiente');
});

test('ficha sin fecha y nombre distinto → descartado', () => {
  const r = evaluarCandidato(cuenta, { dni: '30123456', sexo: null, fechaNacimiento: null, nombre: 'PEREZ ROBERTO' });
  assert.equal(r.estado, 'descartado');
});

test('todo coincide salvo el nombre → pendiente', () => {
  const r = evaluarCandidato(cuenta, { dni: '30123456', sexo: 'F', fechaNacimiento: '1985-04-12', nombre: 'RODRIGUEZ ANA' });
  assert.equal(r.estado, 'pendiente');
});
