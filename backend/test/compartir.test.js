const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../src/app');
const { seedMock, DEMO } = require('../src/mock/seed');
const outbox = require('../src/services/email/outbox');

let app;

test.before(async () => {
  await seedMock();
  app = createApp();
});
test.after(() => outbox.detenerWorker());

async function cliente() {
  const agent = request.agent(app);
  const post = async (url, body) => {
    const token = (await agent.get('/api/auth/csrf')).body.csrfToken;
    return agent.post(url).set('x-csrf-token', token).send(body);
  };
  return { agent, post };
}

async function demo() {
  const c = await cliente();
  const r = await c.post('/api/auth/login', { dni: DEMO.dni, password: DEMO.password });
  assert.equal(r.status, 200);
  return c;
}

test('lista estudios PACS de una internación con tomógrafo', async () => {
  const c = await demo();
  const lista = await c.agent.get('/api/atenciones');
  assert.equal(lista.status, 200);
  const internacion = lista.body.atenciones.find((a) => a.tipo === 'internacion' && a.clinica.id === 101);
  assert.ok(internacion, 'el mock tiene internación en Sarmiento');

  const pacs = await c.agent.get(`/api/atenciones/${internacion.id}/pacs`);
  assert.equal(pacs.status, 200);
  assert.equal(pacs.body.publicados, true);
  assert.equal(pacs.body.disponible, true);
  assert.ok(pacs.body.estudios.length >= 1);
  const json = JSON.stringify(pacs.body);
  assert.doesNotMatch(json, /studyInstanceUid|pacs-sarmiento|1\.2\.826/);
});

test('exporta PDF de la atención', async () => {
  const c = await demo();
  const lista = await c.agent.get('/api/atenciones');
  const a = lista.body.atenciones[0];
  const pdf = await c.agent
    .get(`/api/atenciones/${a.id}/pdf`)
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers['content-type'], /pdf/);
  assert.ok(pdf.body.length > 200);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
});

test('crea link temporal de PDF y lo abre sin sesión', async () => {
  const c = await demo();
  const lista = await c.agent.get('/api/atenciones');
  const a = lista.body.atenciones[0];
  const creado = await c.post(`/api/atenciones/${a.id}/compartir`, { alcance: 'pdf_atencion', horas: 24 });
  assert.equal(creado.status, 201);
  assert.ok(creado.body.url.includes('/c/'));
  const token = creado.body.url.split('/c/').pop();

  const meta = await request(app).get(`/api/c/${token}`);
  assert.equal(meta.status, 200);
  assert.equal(meta.body.tipo, 'pdf_atencion');

  const contenido = await request(app)
    .get(`/api/c/${token}/contenido`)
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
  assert.equal(contenido.status, 200);
  assert.match(contenido.headers['content-type'], /pdf/);
  assert.match(String(contenido.headers['content-disposition'] || ''), /attachment/);
});

test('comparte un estudio PACS con link temporal', async () => {
  const c = await demo();
  const lista = await c.agent.get('/api/atenciones');
  const internacion = lista.body.atenciones.find((a) => a.tipo === 'internacion' && a.clinica.id === 101);
  const pacs = await c.agent.get(`/api/atenciones/${internacion.id}/pacs`);
  const estudio = pacs.body.estudios[0];
  assert.ok(estudio);

  const creado = await c.post(`/api/atenciones/${internacion.id}/compartir`, {
    alcance: 'pacs_estudio',
    recursoId: estudio.id,
    horas: 48
  });
  assert.equal(creado.status, 201);
  const token = creado.body.url.split('/c/').pop();

  const contenido = await request(app).get(`/api/c/${token}/contenido`);
  assert.equal(contenido.status, 200);
  assert.ok(Array.isArray(contenido.body.archivos));
  assert.ok(contenido.body.archivos.length >= 1);

  const archivo = contenido.body.archivos[0];
  const dcm = await request(app)
    .get(`/api/c/${token}/archivo/${encodeURIComponent(archivo.id)}`)
    .buffer(true)
    .parse((res, cb) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => cb(null, Buffer.concat(partes)));
    });
  assert.equal(dcm.status, 200);
  assert.match(dcm.headers['content-type'], /dicom/);
  assert.equal(dcm.body.subarray(128, 132).toString(), 'DICM');
});
