// Códigos de un solo uso (6 dígitos): se guardan como HMAC, vencen a los 10 minutos y admiten 5 intentos.
const { getRepos } = require('../repos');
const { randomCode, hashCode, safeEqual } = require('../lib/crypto');

const VIGENCIA_MIN = 10;
const MAX_INTENTOS = 5;

async function emitir(idCuenta, proposito, canal = 'email') {
  const codigo = randomCode();
  await getRepos().codigos.crear({
    idCuenta,
    canal,
    proposito,
    codigoHash: hashCode(codigo, `${idCuenta}:${proposito}`),
    expiraEn: new Date(Date.now() + VIGENCIA_MIN * 60_000)
  });
  return { codigo, minutos: VIGENCIA_MIN };
}

/** Devuelve true si el código es válido y lo consume. */
async function verificar(idCuenta, proposito, codigo) {
  const repos = getRepos();
  const vigente = await repos.codigos.vigente(idCuenta, proposito);
  if (!vigente || vigente.intentos >= MAX_INTENTOS) return false;
  const ok = safeEqual(vigente.codigoHash, hashCode(String(codigo), `${idCuenta}:${proposito}`));
  if (!ok) {
    await repos.codigos.sumarIntento(vigente.id);
    return false;
  }
  await repos.codigos.marcarUsado(vigente.id);
  return true;
}

module.exports = { emitir, verificar, VIGENCIA_MIN, MAX_INTENTOS };
