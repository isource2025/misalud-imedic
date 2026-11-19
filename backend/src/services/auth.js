// Cuenta del paciente. Diseño tomado de IOSCOR (registro → verificación de email → login → recuperación),
// corrigiendo sus fallas: códigos de un solo uso con hash y vencimiento, contraseña validada antes que cualquier
// otra cosa, respuestas uniformes que no revelan si un DNI existe, Argon2id y revocación de sesiones.
const argon2 = require('argon2');
const { config } = require('../config');
const { getRepos } = require('../repos');
const codes = require('./codes');
const outbox = require('./email/outbox');
const { getRenaperProvider } = require('./identidad/renaper');
const vinculos = require('./vinculos');
const { normalizeDni, nameSimilarity, maskEmail } = require('../lib/text');
const { HttpError, unprocessable, forbidden } = require('../lib/errors');

const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };
let dummyHash = null;
const getDummyHash = async () => (dummyHash ||= await argon2.hash('contraseña-inexistente-para-timing', ARGON_OPTS));

const hashPassword = (pw) => argon2.hash(pw, ARGON_OPTS);

async function passwordValida(cuenta, password) {
  const hash = cuenta?.passwordHash || (await getDummyHash());
  const ok = await argon2.verify(hash, password).catch(() => false);
  return Boolean(cuenta) && ok;
}

const primerNombre = (nombreCompleto) => String(nombreCompleto || '').trim().split(/\s+/)[0] || '';

/** En MOCK_MODE se devuelve el código en la respuesta para poder probar sin email real. */
const demo = (codigo) => (config.MOCK_MODE && codigo ? { codigoDemo: codigo } : {});

function cuentaPublica(c) {
  return {
    dni: c.dni,
    nombreCompleto: c.nombreCompleto,
    nombre: primerNombre(c.nombreCompleto),
    sexo: c.sexo,
    email: c.email,
    telefono: c.telefono,
    fechaNacimiento: c.fechaNacimiento,
    emailVerificado: Boolean(c.emailVerificadoEn),
    identidadVerificada: Boolean(c.identidadVerificadaEn),
    metodoIdentidad: c.metodoIdentidad,
    creadoEn: c.creadoEn
  };
}

async function enviarCodigo(cuenta, proposito) {
  const { codigo, minutos } = await codes.emitir(cuenta.id, proposito);
  await outbox.encolar(cuenta.email, proposito === 'reset' ? 'codigo-reset' : 'codigo-verificacion', {
    nombre: primerNombre(cuenta.nombreCompleto),
    codigo,
    minutos
  });
  return codigo;
}

const RESPUESTA_REGISTRO = {
  ok: true,
  siguiente: 'verificar-email',
  mensaje: 'Si los datos son correctos, te enviamos un código de 6 dígitos a tu email.'
};

async function registrar(datos) {
  const repos = getRepos();
  const dni = normalizeDni(datos.dni);
  const email = datos.email.trim().toLowerCase();
  const existente = await repos.cuentas.porDni(dni);

  if (existente?.emailVerificadoEn) {
    await outbox.encolar(existente.email, 'registro-existente', { nombre: primerNombre(existente.nombreCompleto) });
    return RESPUESTA_REGISTRO;
  }
  if (await repos.cuentas.existeEmailVerificado(email, existente?.id)) {
    throw new HttpError(409, 'EMAIL_EN_USO', 'Ese email ya está asociado a otra cuenta.');
  }

  const fields = {
    sexo: datos.sexo,
    nombreCompleto: datos.nombreCompleto.trim().replace(/\s+/g, ' '),
    email,
    telefono: datos.telefono || null,
    passwordHash: await hashPassword(datos.password)
  };
  // Un registro sin email verificado no da acceso a nada: se puede rehacer.
  const cuenta = existente ? await repos.cuentas.actualizar(existente.id, fields) : await repos.cuentas.crear({ dni, ...fields });
  const codigo = await enviarCodigo(cuenta, 'verificar');
  return { ...RESPUESTA_REGISTRO, ...demo(codigo) };
}

async function reenviarCodigoEmail(dni) {
  const cuenta = await getRepos().cuentas.porDni(normalizeDni(dni));
  let codigo = null;
  if (cuenta && !cuenta.emailVerificadoEn) codigo = await enviarCodigo(cuenta, 'verificar');
  return { ok: true, mensaje: 'Si corresponde, te enviamos un código nuevo.', ...demo(codigo) };
}

async function verificarEmail(dni, codigo) {
  const repos = getRepos();
  const cuenta = await repos.cuentas.porDni(normalizeDni(dni));
  if (!cuenta || cuenta.emailVerificadoEn || !(await codes.verificar(cuenta.id, 'verificar', codigo))) {
    throw new HttpError(400, 'CODIGO_INVALIDO', 'El código es incorrecto o venció. Pedí uno nuevo.');
  }
  if (await repos.cuentas.existeEmailVerificado(cuenta.email, cuenta.id)) {
    throw new HttpError(409, 'EMAIL_EN_USO', 'Ese email ya está asociado a otra cuenta.');
  }
  return repos.cuentas.actualizar(cuenta.id, { emailVerificadoEn: new Date() });
}

async function login(dni, password) {
  const cuenta = await getRepos().cuentas.porDni(normalizeDni(dni));
  if (!(await passwordValida(cuenta, password)) || cuenta.estado !== 'activa') {
    throw new HttpError(401, 'CREDENCIALES_INVALIDAS', 'DNI o contraseña incorrectos.');
  }
  if (!cuenta.emailVerificadoEn) {
    const codigo = await enviarCodigo(cuenta, 'verificar');
    return { cuenta, requiereVerificacionEmail: true, emailEnmascarado: maskEmail(cuenta.email), ...demo(codigo) };
  }
  return { cuenta, requiereVerificacionEmail: false };
}

async function olvidePassword(dni) {
  const cuenta = await getRepos().cuentas.porDni(normalizeDni(dni));
  let codigo = null;
  if (cuenta?.emailVerificadoEn && cuenta.estado === 'activa') codigo = await enviarCodigo(cuenta, 'reset');
  return { ok: true, mensaje: 'Si el DNI tiene una cuenta, te enviamos un código al email registrado.', ...demo(codigo) };
}

async function resetPassword(dni, codigo, password) {
  const repos = getRepos();
  const cuenta = await repos.cuentas.porDni(normalizeDni(dni));
  if (!cuenta || !(await codes.verificar(cuenta.id, 'reset', codigo))) {
    throw new HttpError(400, 'CODIGO_INVALIDO', 'El código es incorrecto o venció. Pedí uno nuevo.');
  }
  await repos.cuentas.actualizar(cuenta.id, { passwordHash: await hashPassword(password) });
  await repos.sesiones.revocarTodas(cuenta.id);
  await outbox.encolar(cuenta.email, 'password-cambiada', { nombre: primerNombre(cuenta.nombreCompleto) });
  return { ok: true };
}

async function cambiarPassword(cuenta, actual, nueva) {
  const repos = getRepos();
  const fresca = await repos.cuentas.porId(cuenta.id);
  if (!(await passwordValida(fresca, actual))) throw new HttpError(400, 'PASSWORD_ACTUAL_INVALIDA', 'La contraseña actual no es correcta.');
  await repos.cuentas.actualizar(cuenta.id, { passwordHash: await hashPassword(nueva) });
  await repos.sesiones.revocarTodas(cuenta.id);
  await outbox.encolar(fresca.email, 'password-cambiada', { nombre: primerNombre(fresca.nombreCompleto) });
}

async function actualizarContacto(cuenta, { telefono }) {
  return getRepos().cuentas.actualizar(cuenta.id, { telefono, telefonoVerificadoEn: null });
}

const METODOS_IDENTIDAD = ['renaper_dni', 'renaper_foto'];

/**
 * Verificación de identidad. MVP: RENAPER con número de DNI (decisión 1).
 * 'renaper_foto' (foto del DNI) queda reservado: mismo contrato, otro proveedor.
 */
async function verificarIdentidad(cuenta, { metodo = 'renaper_dni', fotoDni } = {}, { auditar } = {}) {
  if (!cuenta.emailVerificadoEn) throw forbidden('Primero verificá tu email.', 'EMAIL_NO_VERIFICADO');
  if (metodo === 'renaper_foto') {
    throw new HttpError(501, 'METODO_NO_DISPONIBLE', 'La validación con foto del DNI todavía no está disponible.');
  }
  if (cuenta.identidadVerificadaEn) {
    return { cuenta, clinicas: await vinculos.buscar(cuenta, { auditar }) };
  }

  let resultado;
  try {
    resultado = await getRenaperProvider().consultar({ dni: cuenta.dni, sexo: cuenta.sexo, nombreDeclarado: cuenta.nombreCompleto, fotoDni });
  } catch (err) {
    throw new HttpError(503, 'RENAPER_NO_DISPONIBLE', 'No pudimos consultar RENAPER en este momento. Probá de nuevo en unos minutos.');
  }
  if (!resultado.ok) {
    auditar?.({ accion: 'identidad_verificar', resultado: 'no_encontrado' });
    throw unprocessable('RENAPER no encontró una persona con ese DNI.', 'RENAPER_NO_ENCONTRADO');
  }

  const p = resultado.persona;
  const sexoOk = !p.sexo || cuenta.sexo === 'X' || p.sexo === cuenta.sexo;
  const nombreOk = nameSimilarity(cuenta.nombreCompleto, `${p.nombres} ${p.apellido}`) >= 0.5;
  if (!sexoOk || !nombreOk) {
    auditar?.({ accion: 'identidad_verificar', resultado: 'no_coincide' });
    throw unprocessable(
      'Los datos de tu cuenta no coinciden con RENAPER. Revisá que el nombre y el sexo sean los de tu DNI.',
      'RENAPER_NO_COINCIDE'
    );
  }

  if (config.MOCK_MODE) {
    require('../clinicas/mockSource').asegurarPaciente({ dni: cuenta.dni, nombre: `${p.apellido} ${p.nombres}`, sexo: p.sexo || cuenta.sexo, fechaNacimiento: p.fechaNacimiento });
  }

  const actualizada = await getRepos().cuentas.actualizar(cuenta.id, {
    identidadVerificadaEn: new Date(),
    metodoIdentidad: metodo,
    fechaNacimiento: p.fechaNacimiento || null,
    ...(p.sexo ? { sexo: p.sexo } : {})
  });
  auditar?.({ accion: 'identidad_verificar', resultado: 'ok' });
  const clinicas = await vinculos.buscar(actualizada, { auditar });
  return { cuenta: actualizada, clinicas };
}

module.exports = {
  registrar,
  reenviarCodigoEmail,
  verificarEmail,
  login,
  olvidePassword,
  resetPassword,
  cambiarPassword,
  actualizarContacto,
  verificarIdentidad,
  cuentaPublica,
  hashPassword,
  METODOS_IDENTIDAD
};
