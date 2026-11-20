// Exporta la historia clínica de una atención como PDF (solo lectura).
const PDFDocument = require('pdfkit');
const atenciones = require('./atenciones');
const { notFound } = require('../lib/errors');

function linea(doc, label, value) {
  if (value == null || value === '') return;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor('#0f172a').text(String(value));
}

function seccion(doc, titulo) {
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#0ea5e9').text(titulo);
  doc.moveDown(0.25);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.4);
}

function texto(doc, t) {
  if (!t) return;
  doc.font('Helvetica').fontSize(11).fillColor('#1e293b').text(String(t), { align: 'justify', lineGap: 2 });
}

async function generarBuffer(cuenta, idAtencion) {
  let detalle;
  try {
    detalle = await atenciones.detalle(cuenta, idAtencion);
  } catch (err) {
    if (err.status === 404) throw notFound('Atención no encontrada');
    throw err;
  }
  const { _ref, ...a } = detalle;

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Historia clínica — MiSalud', Author: 'MiSalud.Imedic' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('MiSalud');
  doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('Historia clínica del paciente (solo lectura)');
  doc.moveDown(0.6);

  seccion(doc, 'Atención');
  linea(doc, 'Paciente', cuenta.nombreCompleto || cuenta.nombre);
  linea(doc, 'DNI', cuenta.dni);
  linea(doc, 'Clínica', a.clinica?.nombre);
  linea(doc, 'Tipo', a.tipoLabel);
  linea(doc, 'Servicio', a.servicio);
  linea(doc, 'Ingreso', [a.fechaIngreso, a.horaIngreso].filter(Boolean).join(' · '));
  if (a.fechaEgreso) linea(doc, 'Egreso', a.fechaEgreso);
  linea(doc, 'Profesional', a.profesional);
  linea(doc, 'Centro', a.centro);

  if (a.diagnostico) {
    seccion(doc, 'Diagnóstico de ingreso');
    linea(doc, 'Código', a.diagnostico.codigo);
    linea(doc, 'Descripción', a.diagnostico.descripcion);
  }
  if (a.diagnosticoEgreso) {
    seccion(doc, 'Diagnóstico de egreso');
    linea(doc, 'Código', a.diagnosticoEgreso.codigo);
    linea(doc, 'Descripción', a.diagnosticoEgreso.descripcion);
  }

  for (const h of a.hcIngreso || []) {
    seccion(doc, 'Historia de ingreso');
    linea(doc, 'Fecha', [h.fecha, h.hora].filter(Boolean).join(' · '));
    linea(doc, 'Profesional', h.profesional);
    if (h.motivoConsulta) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text('Motivo de consulta');
      texto(doc, h.motivoConsulta);
      doc.moveDown(0.3);
    }
    if (h.enfermedadActual) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text('Enfermedad actual');
      texto(doc, h.enfermedadActual);
      doc.moveDown(0.3);
    }
    for (const t of h.textos || []) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(t.titulo);
      texto(doc, t.texto);
      doc.moveDown(0.3);
    }
    for (const s of h.secciones || []) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text(s.titulo);
      for (const c of s.campos || []) linea(doc, c.campo, c.valor);
      doc.moveDown(0.2);
    }
  }

  for (const e of a.epicrisis || []) {
    seccion(doc, 'Epicrisis');
    linea(doc, 'Fecha', [e.fecha, e.hora].filter(Boolean).join(' · '));
    linea(doc, 'Profesional', e.profesional);
    texto(doc, e.texto);
    if (e.diagnostico) {
      doc.moveDown(0.3);
      linea(doc, 'Diagnóstico al alta', [e.diagnostico.codigo, e.diagnostico.descripcion].filter(Boolean).join(' — '));
    }
  }

  doc.moveDown(1.2);
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text(
    `Generado el ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Información publicada por ${a.clinica?.nombre || 'la clínica'}. Ante dudas, consultá a tu médico.`,
    { align: 'left' }
  );

  doc.end();
  const buffer = await done;
  const nombre = `historia-${(a.fechaIngreso || 'atencion').slice(0, 10)}.pdf`;
  return { buffer, nombre, _ref };
}

module.exports = { generarBuffer };
