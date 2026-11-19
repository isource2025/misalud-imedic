const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const http = require('node:http');

const KEY = 'k'.repeat(40);
process.env.FILE_SERVER_SIGNING_KEYS = JSON.stringify({ 101: KEY });
process.env.IMEDIC_SIGNING_MASTER = 'maestra-de-prueba-0123456789abcdef';

const signed = require('../src/lib/signedFileToken');
const { firmarPedido, pedirAClinica } = require('../src/clinicas/clinicaHttp');
const { mapearFilaCatalogo, invalidarCache } = require('../src/clinicas/empresas');
const { normalizarPersona } = require('../src/services/identidad/renaper');
const { getRepos } = require('../src/repos');

test('la firma sigue el formato v1 de iMedic (método + ruta + query ordenado, sin sig)', () => {
  const now = 1_800_000_000_000;
  const { [signed.HEADER]: token } = firmarPedido({ servicio: 'fs', idEmpresa: 101, url: '/files/a%20b?z=1&a=2&sig=x', now });
  const [v, id, exp, firma] = token.split('.');
  assert.equal(v, 'v1');
  assert.equal(id, '101');
  assert.equal(Number(exp), now / 1000 + 120);
  const msg = ['v1', '101', 'GET', '/files/a b', 'a=2&z=1', exp].join('\n');
  const esperada = crypto.createHmac('sha256', KEY).update(msg).digest('base64url');
  assert.equal(firma, esperada);
});

test('sin mapa explícito usa la clave derivada de IMEDIC_SIGNING_MASTER', () => {
  const derivada = crypto.createHmac('sha256', process.env.IMEDIC_SIGNING_MASTER).update('imedic:pacs:102').digest('hex');
  assert.equal(signed.clinicKeyFor('pacs', 102), derivada);
  assert.equal(signed.clinicKeyFor('fs', 101), KEY);
});

test('pedirAClinica firma y el servidor de la clínica lo acepta (y rechaza sin firma)', async (t) => {
  const server = http.createServer((req, res) => {
    const r = signed.verifyRequest({
      token: signed.tokenFromRequest(req.headers, req.url),
      key: KEY,
      method: req.method,
      url: req.url,
      idEmpresaEsperada: 101
    });
    res.writeHead(r.ok ? 200 : 401).end(r.ok ? 'ok' : r.motivo);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/adjuntos`;
  process.env.CLINICA_101_FILE_SERVER_URL = base;
  await getRepos().empresas.guardar({ idEmpresa: 101, nombreVisible: 'Sarmiento', habilitada: true });
  invalidarCache();

  const ok = await pedirAClinica({ servicio: 'fs', idEmpresa: 101, ruta: '/files?path=E%3A%5Cx.pdf' });
  assert.equal(ok.status, 200);
  const sinFirma = await fetch(`${base}/files?path=x`);
  assert.equal(sinFirma.status, 401);
  await assert.rejects(pedirAClinica({ servicio: 'fs', idEmpresa: 101, ruta: 'http://otro-host/files' }), { code: 'RUTA_INVALIDA' });
});

test('clínica sin clave de firma: no se manda el pedido', () => {
  delete process.env.IMEDIC_SIGNING_MASTER;
  assert.throws(() => firmarPedido({ servicio: 'fs', idEmpresa: 999, url: '/x' }), { code: 'CLINICA_SIN_CLAVE_FIRMA' });
});

test('catálogo vw_MiSaludEmpresas: respeta PortalHabilitado si la vista lo expone', () => {
  const base = { IDEMPRESA: 101, DESCRIPCION: 'Sarmiento', DbServer: 'sql.x', DbPort: '51433', DbName: 'SARMIENTO', FileServerUrl: 'https://files-sarmiento.imedic.com.ar' };
  const sinFlag = mapearFilaCatalogo(base);
  assert.equal(sinFlag.habilitadoEnImedic, true);
  assert.deepEqual(sinFlag.db, { server: 'sql.x', port: 51433, instance: null, database: 'SARMIENTO' });
  assert.equal(mapearFilaCatalogo({ ...base, PortalHabilitado: 0 }).habilitadoEnImedic, false);
});

test('RENAPER: la persona normalizada no conserva fotos ni URLs', () => {
  const p = normalizarPersona({ numeroDocumento: '30123456', apellido: 'GOMEZ', nombres: 'MARIA', sexo: 'F', foto: 'data:image/png;base64,AAA', fotoUrl: 'https://x/foto.jpg?exp=1&sig=2' });
  assert.deepEqual(Object.keys(p).sort(), ['apellido', 'dni', 'fechaNacimiento', 'nombreCompleto', 'nombres', 'sexo']);
});

test('el catálogo leído no conserva el logo', () => {
  const fila = mapearFilaCatalogo({ IDEMPRESA: 101, DESCRIPCION: 'Sarmiento', Logo: 'https://x/logo.png' });
  assert.equal('logo' in fila || 'Logo' in fila, false);
});
