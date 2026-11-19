const normalizeDni = (value) => String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');

const normalizeName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Similitud de nombres por tokens (0..1), tolerante al orden "APELLIDO NOMBRE". */
function nameSimilarity(a, b) {
  const ta = new Set(normalizeName(a).split(' ').filter((t) => t.length > 1));
  const tb = new Set(normalizeName(b).split(' ').filter((t) => t.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

const normalizeSexo = (value) => {
  const s = normalizeName(value).charAt(0);
  return s === 'M' || s === 'F' ? s : s === 'X' ? 'X' : null;
};

const maskEmail = (email) => {
  const [user, domain] = String(email || '').split('@');
  if (!domain) return '';
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(2, user.length - 1))}@${domain}`;
};

const titleCase = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/(^|\s|-)(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())
    .trim();

module.exports = { normalizeDni, normalizeName, nameSimilarity, normalizeSexo, maskEmail, titleCase };
