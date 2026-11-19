// Fechas Clarion: entero de días desde 1800-12-28.
const CLARION_EPOCH_UTC = Date.UTC(1800, 11, 28);

function clarionToIsoDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(CLARION_EPOCH_UTC + n * 86_400_000).toISOString().slice(0, 10);
}

function isoDateToClarion(iso) {
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.round((t - CLARION_EPOCH_UTC) / 86_400_000);
}

/** Acepta Date, 'YYYY-MM-DD...' o entero Clarion. */
function toIsoDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return clarionToIsoDate(value);
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

module.exports = { clarionToIsoDate, isoDateToClarion, toIsoDate };
