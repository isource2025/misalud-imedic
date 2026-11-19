// Proveedores de validación de identidad contra RENAPER.
// - imedic-proxy: usa el endpoint existente de iMedic SaaS GET /api/integrations/bot/renaper/:dni
//   (X-API-Key + X-Empresa-Id), que ya consulta el Federador del MSAL. El portal no maneja credenciales de RENAPER.
// - mock: respuestas simuladas para desarrollo.
// Contrato común: consultar({ dni, sexo, fotoDni }) → { ok: true, persona } | { ok: false, reason }.
// `fotoDni` queda reservado para la validación con foto del DNI (fase siguiente).
const { config } = require('../../config');
const { normalizeDni, normalizeSexo, titleCase } = require('../../lib/text');

function fechaIso(value) {
  const s = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function normalizarPersona(p, sexoDetectado) {
  const apellido = String(p.apellido || p.apellidos || '').trim();
  const nombres = String(p.nombres || p.nombre || '').trim();
  return {
    dni: normalizeDni(p.numeroDocumento || p.dni),
    apellido,
    nombres,
    nombreCompleto: titleCase(`${nombres} ${apellido}`),
    sexo: normalizeSexo(p.sexo) || normalizeSexo(sexoDetectado) || (p.idSexo === 1 ? 'F' : p.idSexo === 2 ? 'M' : null),
    fechaNacimiento: fechaIso(p.fechaNacimiento || p.fecha_nacimiento)
  };
}

const imedicProxy = {
  nombre: 'imedic-proxy',
  async consultar({ dni }) {
    const base = String(config.RENAPER_PROXY_BASE_URL || '').replace(/\/$/, '');
    if (!base) throw Object.assign(new Error('RENAPER_PROXY_BASE_URL no configurada'), { code: 'RENAPER_NO_CONFIGURADO' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), config.RENAPER_TIMEOUT_MS);
    try {
      const resp = await fetch(`${base}/renaper/${encodeURIComponent(normalizeDni(dni))}`, {
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          ...(config.RENAPER_PROXY_API_KEY ? { 'X-API-Key': config.RENAPER_PROXY_API_KEY } : {}),
          ...(config.RENAPER_PROXY_EMPRESA_ID ? { 'X-Empresa-Id': config.RENAPER_PROXY_EMPRESA_ID } : {})
        }
      });
      if (resp.status === 404) return { ok: false, reason: 'not_found' };
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.success || !body?.persona) {
        throw Object.assign(new Error(`RENAPER respondió ${resp.status}`), { code: 'RENAPER_UNAVAILABLE' });
      }
      return { ok: true, persona: normalizarPersona(body.persona, body.sexoDetectado) };
    } catch (err) {
      if (err.code) throw err;
      throw Object.assign(new Error('RENAPER no disponible'), { code: err.name === 'AbortError' ? 'RENAPER_TIMEOUT' : 'RENAPER_UNAVAILABLE' });
    } finally {
      clearTimeout(timer);
    }
  }
};

// Mock: DNI terminado en 0 → no encontrado. El demo 30123456 es María Laura Gómez.
// Para cualquier otro DNI devuelve el nombre declarado en la cuenta (así el flujo completo se puede probar).
const mock = {
  nombre: 'mock',
  async consultar({ dni, sexo, nombreDeclarado }) {
    await new Promise((r) => setTimeout(r, 700));
    const d = normalizeDni(dni);
    if (d.endsWith('0')) return { ok: false, reason: 'not_found' };
    if (d === '30123456') {
      return { ok: true, persona: normalizarPersona({ numeroDocumento: d, apellido: 'GOMEZ', nombres: 'MARIA LAURA', sexo: 'F', fechaNacimiento: '1985-04-12' }) };
    }
    const n = Number(d.slice(-4)) || 1;
    const fecha = `${1960 + (n % 40)}-${String((n % 12) + 1).padStart(2, '0')}-${String((n % 27) + 1).padStart(2, '0')}`;
    const partes = String(nombreDeclarado || 'Paciente Demo').trim().split(/\s+/);
    const apellido = partes.length > 1 ? partes.pop() : 'Demo';
    return { ok: true, persona: normalizarPersona({ numeroDocumento: d, apellido, nombres: partes.join(' '), sexo, fechaNacimiento: fecha }) };
  }
};

function getRenaperProvider() {
  return config.renaperMode === 'mock' ? mock : imedicProxy;
}

module.exports = { getRenaperProvider, normalizarPersona };
