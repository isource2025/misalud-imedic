const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { filtrarEstudiosDeVisita, visitaDueniaDelEstudio } = require('../src/services/pacs');

const estudio = (uid, studyDate, accessionNumber = '') => ({
  studyInstanceUid: uid,
  studyDate,
  accessionNumber
});

describe('filtrarEstudiosDeVisita', () => {
  it('prioriza AccessionNumber = NumeroVisita', () => {
    const r = filtrarEstudiosDeVisita(
      [estudio('a', '20260115', '100'), estudio('b', '20260115', '200')],
      { numeroVisita: 100, desde: '2026-01-01', hasta: '2026-01-31' }
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].studyInstanceUid, 'a');
  });

  it('sin accession usa ventana de fechas', () => {
    const r = filtrarEstudiosDeVisita([estudio('x', '20260110'), estudio('y', '20260201')], {
      numeroVisita: 1,
      desde: '2026-01-01',
      hasta: '2026-01-31'
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].studyInstanceUid, 'x');
  });

  it('sin fecha de estudio o sin desde no asigna por fecha', () => {
    assert.equal(filtrarEstudiosDeVisita([estudio('x', '')], { numeroVisita: 1, desde: '2026-01-01', hasta: '2026-12-31' }).length, 0);
    assert.equal(filtrarEstudiosDeVisita([estudio('x', '20260101')], { numeroVisita: 1, desde: null, hasta: null }).length, 0);
  });

  it('con visitas hermanas asigna el estudio a la visita dueña más reciente', () => {
    const visitas = [
      { numeroVisita: 2, desde: '2026-03-01', hasta: '2026-03-05' },
      { numeroVisita: 1, desde: '2026-03-01', hasta: '2026-03-05' }
    ];
    const enReciente = filtrarEstudiosDeVisita([estudio('ct', '20260302')], {
      numeroVisita: 2,
      desde: '2026-03-01',
      hasta: '2026-03-05',
      visitasPaciente: visitas
    });
    const enAnterior = filtrarEstudiosDeVisita([estudio('ct', '20260302')], {
      numeroVisita: 1,
      desde: '2026-03-01',
      hasta: '2026-03-05',
      visitasPaciente: visitas
    });
    assert.equal(enReciente.length, 1);
    assert.equal(enAnterior.length, 0);
  });
});

describe('visitaDueniaDelEstudio', () => {
  it('elige la primera visita que cubre la fecha', () => {
    const v = visitaDueniaDelEstudio('20260302', [
      { numeroVisita: 9, desde: '2026-03-01', hasta: '2026-03-10' },
      { numeroVisita: 8, desde: '2026-02-01', hasta: '2026-02-28' }
    ]);
    assert.equal(v.numeroVisita, 9);
  });
});
