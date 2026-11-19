// Agrupa las columnas planas de imHCI en secciones, como la vista de HC de ingreso de iMedic
// (iMedicSaaSFront: hc-ingreso/camposHci.ts y utils/hciIngresoDisplay.ts). Cada formulario del examen físico es un
// prefijo de columna (EO_TONO → "Examen Oftalmológico" / "TONO"); un prefijo nuevo aparece con su sigla, sin cambiar código.

const SECCIONES = {
  SV: 'Signos vitales',
  PF: 'Piel y faneras',
  TCS: 'Tejido celular subcutáneo',
  SL: 'Sistema linfático',
  SOAM: 'Sistema osteoarticulomuscular',
  C: 'Cabeza',
  CU: 'Cuello',
  M: 'Mamas',
  MI: 'Mamas (inspección)',
  MP: 'Mamas (palpación)',
  AR: 'Aparato respiratorio',
  AC: 'Aparato cardiovascular',
  ACV: 'Aparato cardiovascular',
  A: 'Abdomen',
  AD: 'Abdomen',
  AUG: 'Aparato urogenital',
  AIG: 'Aparato urogenital',
  EG: 'Examen ginecológico',
  SN: 'Sistema nervioso',
  EN: 'Sistema nervioso',
  EO: 'Examen oftalmológico',
  EC: 'Electrocardiograma',
  RDT: 'Radiografía de tórax',
  PD: 'Plan diagnóstico',
  PT: 'Plan terapéutico',
  ID: 'Impresión diagnóstica',
  DIA: 'Diabetes',
  AP: 'Antecedentes personales'
};

const TEXTOS_LIBRES = {
  Semiologia: 'Semiología',
  IMPRESIONDIAGNOSTICA: 'Impresión diagnóstica',
  EXAMENCOMPLEMENTARIO: 'Exámenes complementarios',
  COMENTARIODEINGRESO: 'Comentario de ingreso',
  ModMedica: 'Modificación médica'
};

const valorVisible = (v) => {
  if (v === null || v === undefined || v === 0 || typeof v === 'boolean') return null;
  if (v instanceof Date) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const nombreCampo = (columna) => columna.replace(/^[A-Z]+[ _]+/, '').replace(/_/g, ' ').trim() || columna;

/** fila de imHCI (SELECT hc.*) → { textos: [{titulo, texto}], secciones: [{titulo, campos: [{campo, valor}]}] } */
function seccionesHci(fila) {
  const textos = [];
  for (const [col, titulo] of Object.entries(TEXTOS_LIBRES)) {
    const texto = valorVisible(fila[col]);
    if (texto) textos.push({ titulo, texto });
  }
  const porTitulo = new Map();
  for (const [col, valor] of Object.entries(fila)) {
    const m = col.match(/^([A-Z]+)[ _]+\S/);
    if (!m) continue;
    const v = valorVisible(valor);
    if (!v) continue;
    const titulo = SECCIONES[m[1]] || m[1];
    if (!porTitulo.has(titulo)) porTitulo.set(titulo, []);
    porTitulo.get(titulo).push({ campo: nombreCampo(col), valor: v });
  }
  return { textos, secciones: [...porTitulo].map(([titulo, campos]) => ({ titulo, campos })) };
}

/** Último control de imInterCtrlFrecuente asociado a la HC → campos de "Signos vitales", como iMedic. */
function signosDeControl(c) {
  if (!c) return [];
  const n = (v) => (Number(v) > 0 ? Number(v) : null);
  const out = [];
  if (n(c.Maximo)) out.push({ campo: 'Presión arterial', valor: `${n(c.Maximo)}/${n(c.Minimo) || 0} mmHg` });
  if (n(c.Pulso)) out.push({ campo: 'Frecuencia cardíaca', valor: `${n(c.Pulso)} lpm` });
  if (n(c.FrecuenciaRespiratoria)) out.push({ campo: 'Frecuencia respiratoria', valor: `${n(c.FrecuenciaRespiratoria)} rpm` });
  if (n(c.Axilar)) out.push({ campo: 'Temperatura axilar', valor: `${n(c.Axilar).toFixed(1)} °C` });
  if (n(c.Hgt)) out.push({ campo: 'Glucemia', valor: `${n(c.Hgt)} mg/dL` });
  if (n(c.Saturometria)) out.push({ campo: 'Saturación', valor: `${n(c.Saturometria)} %` });
  return out;
}

module.exports = { seccionesHci, signosDeControl, nombreCampo };
