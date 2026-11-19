const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const request = require('supertest');
const { createApp } = require('../src/app');
const { seedMock, DEMO } = require('../src/mock/seed');
const outbox = require('../src/services/email/outbox');
const { sealId, openId } = require('../src/lib/crypto');
const { rutasCandidatas } = require('../src/clinicas/mssqlSource');
const { nombreVisible } = require('../src/services/adjuntos');

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

async function otraCuenta() {
  const c = await cliente();
  const reg = await c.post('/api/auth/registro', {
    dni: '27111222',
    sexo: 'M',
    nombreCompleto: 'Pedro Otro',
    email: 'pedro.otro@ejemplo.com',
    telefono: '3794111222',
    password: 'otra-clave-segura'
  });
  await c.post('/api/auth/email/verificar', { dni: '27111222', codigo: reg.body.codigoDemo });
  await c.post('/api/auth/identidad/verificar', { metodo: 'renaper_dni' });
  return c;
}

async function primerAdjunto(c) {
  const lista = await c.agent.get('/api/atenciones');
  const atencion = lista.body.atenciones.find((a) => a.secciones.adjuntos > 0);
  assert.ok(atencion, 'el mock tiene atenciones con adjuntos');
  const r = await c.agent.get(`/api/atenciones/${atencion.id}/adjuntos`);
  assert.equal(r.status, 200);
  return { atencion, body: r.body, adjunto: r.body.adjuntos[0] };
}

test('lista adjuntos de la atención sin exponer rutas ni ids de la clínica', async () => {
  const c = await demo();
  const { atencion, body } = await primerAdjunto(c);
  assert.equal(body.publicados, true);
  assert.equal(body.adjuntos.length, atencion.secciones.adjuntos);
  const json = JSON.stringify(body);
  assert.doesNotMatch(json, /adjuntos\\\\mock|E:\\\\|"ruta"|idAdjunto|files-/);
  for (const a of body.adjuntos) {
    assert.deepEqual(Object.keys(a).sort(), ['categoria', 'extension', 'fecha', 'id', 'nombre', 'tipo', 'vistaPrevia']);
  }
});

test('abre el archivo inline y lo descarga como attachment, sin cache', async () => {
  const c = await demo();
  const { adjunto } = await primerAdjunto(c);
  const ver = await c.agent.get(`/api/adjuntos/${adjunto.id}/archivo`).buffer(true).parse((res, cb) => {
    const partes = [];
    res.on('data', (d) => partes.push(d));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });
  assert.equal(ver.status, 200);
  assert.equal(ver.headers['content-type'], 'application/pdf');
  assert.match(ver.headers['content-disposition'], /^inline; filename=/);
  assert.match(ver.headers['cache-control'], /no-store/);
  assert.equal(ver.body.subarray(0, 5).toString(), '%PDF-');

  const bajar = await c.agent.get(`/api/adjuntos/${adjunto.id}/archivo?descargar=1`);
  assert.equal(bajar.status, 200);
  assert.match(bajar.headers['content-disposition'], /^attachment; filename=/);

  const disp = await c.agent.get(`/api/adjuntos/${adjunto.id}/disponible`);
  assert.deepEqual(disp.body, { disponible: true });
});

test('otra cuenta, ids alterados o ids de atención no abren adjuntos ajenos', async () => {
  const c = await demo();
  const { atencion, adjunto } = await primerAdjunto(c);
  const ajeno = await otraCuenta();

  assert.equal((await ajeno.agent.get(`/api/adjuntos/${adjunto.id}/archivo`)).status, 404);
  assert.equal((await ajeno.agent.get(`/api/atenciones/${atencion.id}/adjuntos`)).status, 404);

  const ref = openId(adjunto.id);
  // Id bien firmado pero con la cuenta de otro paciente: la clínica no devuelve la visita (pertenencia por IDPACIENTE).
  const cuentaAjena = (await ajeno.agent.get('/api/atenciones')).body;
  assert.ok(cuentaAjena.atenciones.length);
  const idAjena = openId(cuentaAjena.atenciones[0].id).c;
  const forjado = sealId({ ...ref, c: idAjena });
  assert.equal((await ajeno.agent.get(`/api/adjuntos/${forjado}/archivo`)).status, 404);

  const alterado = adjunto.id.slice(0, -2) + (adjunto.id.endsWith('AA') ? 'BB' : 'AA');
  assert.equal((await c.agent.get(`/api/adjuntos/${alterado}/archivo`)).status, 404);
  assert.equal((await c.agent.get(`/api/adjuntos/${atencion.id}/archivo`)).status, 404);
  assert.equal((await request(app).get(`/api/adjuntos/${adjunto.id}/archivo`)).status, 401);
});

test('rutas candidatas y nombre visible', () => {
  assert.deepEqual(rutasCandidatas('D:\\adjuntos\\1 X\\a.pdf'), ['D:\\adjuntos\\1 X\\a.pdf', 'E:\\adjuntos\\1 X\\a.pdf']);
  assert.deepEqual(rutasCandidatas('\\\\SERVER\\Imagenes\\Vidal\\5 Y\\b.jpg'), ['\\\\SERVER\\Imagenes\\Vidal\\5 Y\\b.jpg', '5 Y\\b.jpg']);
  assert.equal(nombreVisible({ descripcion: 'Informe', ruta: 'E:\\x\\123 PEREZ\\scan01.PDF' }), 'Informe.PDF');
  assert.equal(nombreVisible({ descripcion: '', ruta: 'E:\\x\\123 PEREZ\\scan01.pdf' }), 'scan01.pdf');
  assert.equal(nombreVisible({ descripcion: 'C:\\otra\\eco.jpg', ruta: 'E:\\x\\eco.jpg' }), 'eco.jpg');
});

test('file server viejo (sin clave): el pedido sale sin firma; con clave sale firmado', async (t) => {
  const vistos = [];
  const server = http.createServer((req, res) => {
    vistos.push({ url: req.url, sig: req.headers['x-imedic-sig'] || null });
    res.writeHead(200, { 'content-type': 'application/pdf' }).end('%PDF-1.4');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  process.env.CLINICA_555_FILE_SERVER_URL = `http://127.0.0.1:${server.address().port}`;
  const { getRepos } = require('../src/repos');
  const { invalidarCache } = require('../src/clinicas/empresas');
  await getRepos().empresas.guardar({ idEmpresa: 555, nombreVisible: 'Prueba', habilitada: true });
  invalidarCache();

  const real = require('../src/clinicas/mssqlSource');
  const sinClave = await real.abrirArchivoAdjunto(555, 'E:\\adjuntos\\1 Ñ\\a.pdf');
  assert.equal(sinClave.status, 200);
  assert.equal(vistos[0].sig, null);
  assert.match(vistos[0].url, /^\/file\?path=E%253A%255Cadjuntos%255C1%2520%25C3%2591%255Ca\.pdf$/);

  process.env.FILE_SERVER_SIGNING_KEYS = JSON.stringify({ 555: 'k'.repeat(40) });
  await real.abrirArchivoAdjunto(555, 'E:\\adjuntos\\a.pdf');
  assert.match(vistos[1].sig, /^v1\.555\.\d+\./);
  delete process.env.FILE_SERVER_SIGNING_KEYS;
});
