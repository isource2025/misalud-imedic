// Pedidos a los servicios que corren en cada clínica (file server de adjuntos y bridge PACS), firmados con el
// mismo esquema que iMedic SaaS: header x-imedic-sig = v1.<IDEMPRESA>.<exp>.<HMAC> por método + ruta + query.
// ../lib/signedFileToken.js es copia textual de iMedicSaaSBack src/utils/signedFileToken.js: no editarla acá;
// cualquier cambio se hace allá (y en los instaladores PowerShell) y se vuelve a copiar.
// Claves (las mismas de iMedic SaaS): FILE_SERVER_SIGNING_KEYS / PACS_SIGNING_KEYS ({"101":"clave"}) o la
// derivada de IMEDIC_SIGNING_MASTER. A diferencia de iMedic, el portal no manda el token fijo viejo
// (x-imedic-token): solo habla con servidores que ya están en security=v1.
// Las URLs firmadas o de fotos que devuelvan estos servicios no se guardan en ningún lado: vencen.
const { config } = require('../config');
const signed = require('../lib/signedFileToken');
const { obtenerHabilitada } = require('./empresas');

const SERVICIOS = {
  fs: { campo: 'fileServerUrl', ttlEnv: 'FILE_SERVER_SIGNING_TTL_S' },
  pacs: { campo: 'pacsUrl', ttlEnv: 'PACS_SIGNING_TTL_S' }
};

function ttlFor(servicio) {
  const n = Number(process.env[SERVICIOS[servicio].ttlEnv]);
  return Number.isFinite(n) && n > 0 ? Math.min(n, signed.DEFAULT_MAX_TTL_S) : signed.DEFAULT_TTL_S;
}

function error(code, message) {
  return Object.assign(new Error(message), { code });
}

/** Headers firmados para un pedido a `url` (URL absoluta o `ruta?query`). */
function firmarPedido({ servicio, idEmpresa, method = 'GET', url, now }) {
  if (!SERVICIOS[servicio]) throw error('SERVICIO_INVALIDO', `Servicio de clínica desconocido: ${servicio}`);
  const key = signed.clinicKeyFor(servicio, idEmpresa);
  if (!key) throw error('CLINICA_SIN_CLAVE_FIRMA', `Sin clave de firma ${servicio} para la clínica ${idEmpresa}`);
  const token = signed.signRequest({ key, idEmpresa: Number(idEmpresa), method, url, ttlS: ttlFor(servicio), now });
  return { [signed.HEADER]: token };
}

/**
 * GET/HEAD firmado a un servicio de la clínica. Devuelve el Response de fetch (el llamador decide si lo
 * reenvía como stream). `ruta` es relativa a la base del servicio, por ejemplo `/files?path=...`.
 */
async function pedirAClinica({ servicio, idEmpresa, ruta, method = 'GET', timeoutMs = config.CLINICA_TIMEOUT_MS }) {
  const empresa = await obtenerHabilitada(idEmpresa);
  const base = empresa?.[SERVICIOS[servicio]?.campo];
  if (!base) throw error('CLINICA_SIN_SERVICIO', `La clínica ${idEmpresa} no tiene ${servicio} en el catálogo`);
  const url = new URL(String(ruta).replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`);
  if (url.origin !== new URL(base).origin) throw error('RUTA_INVALIDA', 'La ruta sale del servicio de la clínica');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: ctrl.signal,
      redirect: 'error',
      headers: firmarPedido({ servicio, idEmpresa, method, url: url.pathname + url.search })
    });
  } catch (err) {
    if (err.code) throw err;
    throw error(err.name === 'AbortError' ? 'CLINICA_TIMEOUT' : 'CLINICA_NO_DISPONIBLE', `Servicio ${servicio} de la clínica ${idEmpresa} no disponible`);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { firmarPedido, pedirAClinica };
