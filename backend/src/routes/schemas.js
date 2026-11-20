const { z } = require('zod');

const dni = z
  .string({ error: 'Ingresá tu DNI' })
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => /^\d{7,9}$/.test(v), 'El DNI debe tener entre 7 y 9 dígitos');

const password = z
  .string({ error: 'Ingresá una contraseña' })
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .max(128, 'La contraseña es demasiado larga');

const codigo = z.string({ error: 'Ingresá el código' }).regex(/^\d{6}$/, 'El código tiene 6 dígitos');

/**
 * Teléfono argentino → "+54" + 10 dígitos (característica + número). Acepta +54, 9 de celular, 0 de larga
 * distancia y el 15 local después de la característica (2 a 4 dígitos). Devuelve null si no es válido.
 */
function normalizarTelefonoAr(v) {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.startsWith('54')) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 12) {
    const sin15 = [2, 3, 4].map((i) => (d.slice(i, i + 2) === '15' ? d.slice(0, i) + d.slice(i + 2) : null)).find(Boolean);
    if (sin15) d = sin15;
  }
  return /^[1-9]\d{9}$/.test(d) ? `+54${d}` : null;
}

const telefono = z
  .string({ error: 'Ingresá tu teléfono' })
  .trim()
  .min(1, 'Ingresá tu teléfono')
  .transform((v, ctx) => {
    const n = normalizarTelefonoAr(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Ingresá un teléfono argentino con característica, p. ej. 379 4123456' });
    return n ?? z.NEVER;
  });

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

module.exports = {
  normalizarTelefonoAr,
  registro: z.object({
    dni,
    sexo: z.enum(['M', 'F', 'X'], { error: 'Elegí el sexo que figura en tu DNI' }),
    nombreCompleto: z.string().trim().min(5, 'Ingresá tu nombre y apellido').max(200),
    email: z.email({ error: 'Email inválido' }).max(254),
    telefono,
    password
  }),
  soloDni: z.object({ dni }),
  verificarEmail: z.object({ dni, codigo }),
  login: z.object({ dni, password: z.string().min(1, 'Ingresá tu contraseña').max(128) }),
  reset: z.object({ dni, codigo, password }),
  cambiarPassword: z.object({ actual: z.string().min(1).max(128), nueva: password }),
  contacto: z.object({ telefono }),
  identidad: z.object({
    metodo: z.enum(['renaper_dni', 'renaper_foto']).default('renaper_dni'),
    fotoDni: z.string().max(8_000_000).optional()
  }),
  filtrosAtenciones: z.object({
    clinica: z.coerce.number().int().positive().optional(),
    tipo: z.enum(['ambulatorio', 'internacion', 'hospital_dia']).optional(),
    desde: fechaIso.optional(),
    hasta: fechaIso.optional()
  }),
  compartir: z.object({
    alcance: z.enum(['pacs_estudio', 'adjunto', 'pdf_atencion']),
    recursoId: z.string().min(8).max(800).optional(),
    horas: z.coerce.number().int().min(1).max(168).optional(),
    maxUsos: z.coerce.number().int().min(1).max(50).nullable().optional()
  })
};
