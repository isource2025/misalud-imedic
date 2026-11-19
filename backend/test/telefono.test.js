const test = require('node:test');
const assert = require('node:assert');
const { normalizarTelefonoAr } = require('../src/routes/schemas');
const { requireIdentidad } = require('../src/middleware/auth');

test('teléfonos argentinos válidos se normalizan a +54 + 10 dígitos', () => {
  for (const v of ['+54 9 379 412-3456', '5493794123456', '0379 15 4123456', '(0379) 154123456', '3794123456', '011 15 4123 4567', '+54 11 4123-4567']) {
    assert.match(normalizarTelefonoAr(v), /^\+54\d{10}$/, v);
  }
  assert.equal(normalizarTelefonoAr('0379 15 4123456'), '+543794123456');
  assert.equal(normalizarTelefonoAr('+54 9 11 4123-4567'), '+541141234567');
});

test('teléfonos incompletos o extranjeros se rechazan', () => {
  for (const v of ['', '4123456', '123', '+1 415 555 0100', '0000000000', 'abc']) {
    assert.equal(normalizarTelefonoAr(v), null, v);
  }
});

test('sin teléfono no se accede a datos clínicos', () => {
  let err;
  requireIdentidad({ cuenta: { emailVerificadoEn: new Date(), identidadVerificadaEn: new Date(), telefono: null } }, {}, (e) => (err = e));
  assert.equal(err?.code, 'TELEFONO_REQUERIDO');
  requireIdentidad({ cuenta: { emailVerificadoEn: new Date(), identidadVerificadaEn: new Date(), telefono: '+543794123456' } }, {}, (e) => (err = e));
  assert.equal(err, undefined);
});
