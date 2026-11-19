// Datos iniciales del modo mock: clínicas piloto y una cuenta demo ya verificada y vinculada.
const { getRepos } = require('../repos');
const { hashPassword } = require('../services/auth');
const vinculos = require('../services/vinculos');
const { EMPRESAS_MOCK } = require('../clinicas/mockSource');

const DEMO = {
  dni: '30123456',
  password: 'MiSalud2026!',
  nombreCompleto: 'María Laura Gómez',
  email: 'maria.gomez@ejemplo.com',
  telefono: '+5493794000000',
  sexo: 'F',
  fechaNacimiento: '1985-04-12'
};

async function seedMock() {
  const repos = getRepos();
  for (const e of EMPRESAS_MOCK) await repos.empresas.guardar(e);
  if (await repos.cuentas.porDni(DEMO.dni)) return;
  const { password, fechaNacimiento, ...datos } = DEMO;
  const cuenta = await repos.cuentas.crear({ ...datos, passwordHash: await hashPassword(password) });
  const lista = await repos.cuentas.actualizar(cuenta.id, {
    emailVerificadoEn: new Date(),
    identidadVerificadaEn: new Date(),
    metodoIdentidad: 'renaper_dni',
    fechaNacimiento
  });
  await vinculos.buscar(lista);
}

module.exports = { seedMock, DEMO };
