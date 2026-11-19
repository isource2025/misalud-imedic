const path = require('path');
const { z } = require('zod');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const bool = (def) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? def : /^(1|true|yes|si)$/i.test(v)));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(5010),
  MOCK_MODE: bool(false),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().default(1),

  SESSION_JWT_SECRET: z.string().optional(),
  OPAQUE_ID_KEY: z.string().optional(),
  CODE_PEPPER: z.string().optional(),
  ACCESS_TOKEN_MIN: z.coerce.number().int().default(10),
  SESSION_IDLE_MIN: z.coerce.number().int().default(30),
  SESSION_MAX_HOURS: z.coerce.number().int().default(12),

  PORTAL_DB_SERVER: z.string().optional(),
  PORTAL_DB_PORT: z.coerce.number().int().default(1433),
  PORTAL_DB_NAME: z.string().default('MiSaludPortal'),
  PORTAL_DB_USER: z.string().optional(),
  PORTAL_DB_PASSWORD: z.string().optional(),
  PORTAL_DB_ENCRYPT: bool(true),
  PORTAL_DB_TRUST_CERT: bool(false),

  EMPRESAS_SOURCE: z.enum(['portal', 'imedic']).default('portal'),
  IMEDIC_CATALOG_URL: z.string().optional(),
  CLINICA_TIMEOUT_MS: z.coerce.number().int().default(8000),
  CLINICA_CACHE_SEG: z.coerce.number().int().default(180),

  RENAPER_MODE: z.enum(['mock', 'imedic-proxy']).default('imedic-proxy'),
  RENAPER_PROXY_BASE_URL: z.string().optional(),
  RENAPER_PROXY_API_KEY: z.string().optional(),
  RENAPER_PROXY_EMPRESA_ID: z.string().optional(),
  RENAPER_TIMEOUT_MS: z.coerce.number().int().default(20000),

  MAIL_DISPLAY_NAME: z.string().default('MiSalud'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_TRANSPORT: z.enum(['auto', 'console']).default('auto'),

  MOCK_CLINICA_CAIDA: z.string().optional()
});

function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración inválida: ${detail}`);
  }
  const c = parsed.data;

  if (c.MOCK_MODE && c.NODE_ENV === 'production') {
    throw new Error('MOCK_MODE no puede usarse con NODE_ENV=production');
  }

  const devSecret = (name) => {
    if (c[name]) return c[name];
    if (c.NODE_ENV === 'production') throw new Error(`Falta ${name}`);
    return `dev-only-${name}-cambiar`;
  };

  if (!c.MOCK_MODE) {
    const faltantes = ['PORTAL_DB_SERVER', 'PORTAL_DB_USER', 'PORTAL_DB_PASSWORD'].filter((k) => !c[k]);
    if (faltantes.length) {
      throw new Error(`Faltan variables de la base del portal: ${faltantes.join(', ')} (o usá MOCK_MODE=true)`);
    }
    if (c.EMPRESAS_SOURCE === 'imedic' && !c.IMEDIC_CATALOG_URL) {
      throw new Error('EMPRESAS_SOURCE=imedic requiere IMEDIC_CATALOG_URL');
    }
  }

  const corsOrigins = (c.CORS_ORIGINS || c.FRONTEND_URL)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return {
    ...c,
    isProd: c.NODE_ENV === 'production',
    corsOrigins,
    renaperMode: c.MOCK_MODE ? 'mock' : c.RENAPER_MODE,
    emailTransport: c.MOCK_MODE ? 'console' : c.EMAIL_TRANSPORT,
    secrets: {
      sessionJwt: devSecret('SESSION_JWT_SECRET'),
      opaqueId: devSecret('OPAQUE_ID_KEY'),
      codePepper: devSecret('CODE_PEPPER')
    }
  };
}

const config = loadConfig();

module.exports = { config, loadConfig };
