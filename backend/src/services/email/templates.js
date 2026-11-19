// Plantillas en archivos (html + txt), con escape de HTML en todas las variables.
const fs = require('fs');
const path = require('path');
const { config } = require('../../config');

const DIR = path.join(__dirname, 'templates');

const SUBJECTS = {
  'codigo-verificacion': 'Tu código para activar MiSalud',
  'codigo-reset': 'Tu código para restablecer la contraseña de MiSalud',
  'registro-existente': 'Alguien intentó registrarse con tu DNI en MiSalud',
  'password-cambiada': 'Cambiaste la contraseña de MiSalud'
};

const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const cache = new Map();
function load(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(path.join(DIR, file), 'utf8'));
  return cache.get(file);
}

const fill = (tpl, vars, esc) => tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (esc ? escapeHtml(vars[k]) : String(vars[k] ?? '')));

function render(plantilla, datos) {
  if (!SUBJECTS[plantilla]) throw new Error(`Plantilla desconocida: ${plantilla}`);
  const vars = {
    ...datos,
    anio: new Date().getFullYear(),
    portalUrl: config.FRONTEND_URL,
    marca: config.MAIL_DISPLAY_NAME
  };
  const body = fill(load(`${plantilla}.html`), vars, true);
  const html = fill(load('_layout.html'), vars, true).replace('%%CONTENIDO%%', body);
  const text = `${fill(load(`${plantilla}.txt`), vars, false)}\n\n— ${vars.marca} · ${vars.portalUrl}\nEste es un mensaje automático, no lo respondas.`;
  return { subject: SUBJECTS[plantilla], html, text };
}

module.exports = { render, escapeHtml };
