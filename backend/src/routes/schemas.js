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

const telefono = z
  .string()
  .transform((v) => v.replace(/[^\d+]/g, ''))
  .refine((v) => v === '' || /^\+?\d{8,15}$/.test(v), 'Teléfono inválido')
  .optional();

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

module.exports = {
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
  })
};
