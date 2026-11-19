const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../src/app');
const { seedMock, DEMO } = require('../src/mock/seed');
const { render } = require('../src/services/email/templates');
const outbox = require('../src/services/email/outbox');

let app;

test.before(async () => {
  await seedMock();
  app = createApp();
});
test.after(() => outbox.detenerWorker());

async function cliente() {
  const agent = request.agent(app);
  // El token CSRF rota al iniciar sesión: se relee de la cookie antes de cada escritura, como hace el front.
  const csrf = async () => (await agent.get('/api/auth/csrf')).body.csrfToken;
  const post = async (url, body) => {
    const token = await csrf();
    return agent.post(url).set('x-csrf-token', token).send(body);
  };
  const put = async (url, body) => {
    const token = await csrf();
    return agent.put(url).set('x-csrf-token', token).send(body);
  };
  return { agent, post, put };
}

test('rechaza POST sin token CSRF', async () => {
  const r = await request(app).post('/api/auth/login').send({ dni: DEMO.dni, password: DEMO.password });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'CSRF_INVALIDO');
});

test('login con contraseña incorrecta no revela si el DNI existe', async () => {
  const c = await cliente();
  const a = await c.post('/api/auth/login', { dni: DEMO.dni, password: 'incorrecta-123' });
  const b = await c.post('/api/auth/login', { dni: '99888777', password: 'incorrecta-123' });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.deepEqual(a.body, b.body);
});

test('datos clínicos requieren sesión', async () => {
  const r = await request(app).get('/api/atenciones');
  assert.equal(r.status, 401);
});

test('flujo completo: registro → email → identidad RENAPER → atenciones → detalle', async () => {
  const c = await cliente();
  const reg = await c.post('/api/auth/registro', {
    dni: '28.765.433',
    sexo: 'M',
    nombreCompleto: 'Juan Pablo Pérez',
    email: 'juan@ejemplo.com',
    password: 'una-clave-segura'
  });
  assert.equal(reg.status, 202);
  assert.match(reg.body.codigoDemo, /^\d{6}$/);

  const mal = await c.post('/api/auth/email/verificar', { dni: '28765433', codigo: '000000' });
  assert.equal(mal.status, 400);

  const ok = await c.post('/api/auth/email/verificar', { dni: '28765433', codigo: reg.body.codigoDemo });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.cuenta.identidadVerificada, false);

  const sinIdentidad = await c.agent.get('/api/atenciones');
  assert.equal(sinIdentidad.status, 403);
  assert.equal(sinIdentidad.body.error.code, 'IDENTIDAD_NO_VERIFICADA');

  const foto = await c.post('/api/auth/identidad/verificar', { metodo: 'renaper_foto' });
  assert.equal(foto.status, 501);

  const idv = await c.post('/api/auth/identidad/verificar', { metodo: 'renaper_dni' });
  assert.equal(idv.status, 200);
  assert.equal(idv.body.cuenta.identidadVerificada, true);
  assert.ok(idv.body.clinicas.every((x) => x.confirmado >= 1));

  const lista = await c.agent.get('/api/atenciones');
  assert.equal(lista.status, 200);
  assert.ok(lista.body.atenciones.length >= 4);
  assert.deepEqual(lista.body.clinicasNoDisponibles, []);

  const conEpicrisis = lista.body.atenciones.find((a) => a.secciones.epicrisis);
  const det = await c.agent.get(`/api/atenciones/${conEpicrisis.id}`);
  assert.equal(det.status, 200);
  assert.ok(det.body.epicrisis[0].texto.length > 20);
  assert.ok(det.body.hcIngreso[0].motivoConsulta);
  assert.equal(det.body._ref, undefined);

  // Otra cuenta no puede abrir el id opaco de esta atención.
  const demo = await cliente();
  await demo.post('/api/auth/login', { dni: DEMO.dni, password: DEMO.password });
  const ajena = await demo.agent.get(`/api/atenciones/${conEpicrisis.id}`);
  assert.equal(ajena.status, 404);

  const adulterado = await c.agent.get(`/api/atenciones/${conEpicrisis.id.slice(0, -2)}xx`);
  assert.equal(adulterado.status, 404);
});

test('cuenta demo: ficha duplicada vinculada y homónimo descartado', async () => {
  const c = await cliente();
  await c.post('/api/auth/login', { dni: DEMO.dni, password: DEMO.password });
  const r = await c.agent.get('/api/vinculos');
  const guemes = r.body.clinicas.find((x) => x.id === 102);
  const sarmiento = r.body.clinicas.find((x) => x.id === 101);
  assert.equal(guemes.fichasConfirmadas, 2);
  assert.equal(sarmiento.fichasConfirmadas, 1);
});

test('reset de contraseña revoca sesiones', async () => {
  const c = await cliente();
  await c.post('/api/auth/login', { dni: DEMO.dni, password: DEMO.password });
  assert.equal((await c.agent.get('/api/auth/me')).status, 200);

  const otro = await cliente();
  const olvide = await otro.post('/api/auth/password/olvide', { dni: DEMO.dni });
  const reset = await otro.post('/api/auth/password/reset', { dni: DEMO.dni, codigo: olvide.body.codigoDemo, password: DEMO.password });
  assert.equal(reset.status, 200);

  assert.equal((await c.agent.get('/api/auth/me')).status, 401);
});

test('plantillas escapan HTML', () => {
  const { html, text } = render('codigo-verificacion', { nombre: '<script>x</script>', codigo: '123456', minutos: 10 });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(text.includes('123456'));
});
