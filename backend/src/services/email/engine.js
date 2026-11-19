// Motor de transporte de emails, adaptado de IOSCORBack/src/services/emailService.js:
// misma selección de transporte, validación de configuración y clasificación de errores, con estos cambios:
// - Transportes: Resend (principal), SMTP genérico (respaldo) y consola (desarrollo / mock).
// - Sin OAuth de Gmail. Sin envío dentro del request: los reintentos los maneja la cola (outbox.js).
// - Nada de datos personales en los logs.
const { config } = require('../../config');
const logger = require('../../lib/logger');

const PLACEHOLDER_RE = /^(tu_|your_|change_this|example|placeholder)/i;
const isBlank = (v) => !v || !String(v).trim();
const isPlaceholder = (v) => isBlank(v) || PLACEHOLDER_RE.test(String(v).trim());

let transportMode = null; // 'resend' | 'smtp' | 'console'
let resendClient = null;
let smtpTransporter = null;
let initPromise = null;
let lastError = null;

const hasValidResend = () =>
  !isPlaceholder(config.RESEND_API_KEY) && config.RESEND_API_KEY.startsWith('re_') && !isPlaceholder(config.RESEND_FROM) && config.RESEND_FROM.includes('@');

const hasValidSmtp = () =>
  !isPlaceholder(config.SMTP_HOST) && !isPlaceholder(config.SMTP_USER) && !isPlaceholder(config.SMTP_PASSWORD) && !isPlaceholder(config.SMTP_FROM) && config.SMTP_FROM.includes('@');

function validateEmailConfig() {
  if (config.emailTransport === 'console') return { ok: true, problems: [], preferredTransport: 'console' };
  const preferredTransport = hasValidResend() ? 'resend' : hasValidSmtp() ? 'smtp' : null;
  const problems = [];
  if (!preferredTransport) {
    if (!isBlank(config.RESEND_API_KEY) && !config.RESEND_API_KEY.startsWith('re_')) problems.push('RESEND_API_KEY inválida (debe empezar con re_)');
    problems.push('Configurá RESEND_API_KEY + RESEND_FROM (recomendado) o SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM');
  }
  return { ok: Boolean(preferredTransport), problems, preferredTransport };
}

const FATAL_CODES = new Set(['RESEND_AUTH_FAILED', 'RESEND_DOMAIN', 'SMTP_AUTH_FAILED', 'NOT_CONFIGURED']);

function classifySendError(error) {
  const message = error?.message || String(error);
  const combined = `${message} ${JSON.stringify(error?.response?.data || {})}`;
  if (transportMode === 'resend' && (/invalid_api_key|API key is invalid|Unauthorized|missing_api_key/i.test(combined) || error?.statusCode === 401)) {
    return { code: 'RESEND_AUTH_FAILED', message: 'RESEND_API_KEY inválida. Regenerala en https://resend.com/api-keys' };
  }
  if (transportMode === 'resend' && (/domain is not verified|not verified|invalid.*from/i.test(combined) || error?.statusCode === 403)) {
    return { code: 'RESEND_DOMAIN', message: 'El remitente no está verificado en Resend (RESEND_FROM).' };
  }
  if (/Invalid login|Username and Password not accepted|EAUTH/i.test(message)) {
    return { code: 'SMTP_AUTH_FAILED', message: 'SMTP rechazó las credenciales (SMTP_USER / SMTP_PASSWORD).' };
  }
  if (/rate limit|too many requests|429/i.test(combined)) return { code: 'RATE_LIMITED', message: 'El proveedor limitó el envío; se reintenta.' };
  if (/no configurado/i.test(message)) return { code: 'NOT_CONFIGURED', message };
  return { code: 'SEND_FAILED', message: message.slice(0, 300) };
}

async function ensureInitialized() {
  if (transportMode) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const v = validateEmailConfig();
    if (!v.ok) {
      lastError = { code: 'NOT_CONFIGURED', message: `Servicio de correo no configurado: ${v.problems.join('; ')}` };
      logger.error('email_no_configurado', { problems: v.problems });
      return false;
    }
    try {
      if (v.preferredTransport === 'console') {
        transportMode = 'console';
      } else if (v.preferredTransport === 'resend') {
        const { Resend } = require('resend');
        resendClient = new Resend(config.RESEND_API_KEY);
        transportMode = 'resend';
      } else {
        const nodemailer = require('nodemailer');
        smtpTransporter = nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_PORT === 465,
          auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        });
        await smtpTransporter.verify();
        transportMode = 'smtp';
      }
      lastError = null;
      logger.info('email_listo', { transport: transportMode });
      return true;
    } catch (err) {
      lastError = classifySendError(err);
      logger.error('email_init_fallo', { code: lastError.code });
      return false;
    }
  })();
  try {
    return await initPromise;
  } finally {
    if (!transportMode) initPromise = null;
  }
}

const fromAddress = () => (transportMode === 'smtp' ? config.SMTP_FROM : config.RESEND_FROM);

/** Envía un mensaje ya renderizado. Lanza un error con `code` y `fatal` si falla. */
async function send({ to, subject, html, text }) {
  const ok = await ensureInitialized();
  if (!ok) throw Object.assign(new Error(lastError?.message || 'Servicio de correo no configurado'), { code: 'NOT_CONFIGURED', fatal: true });
  try {
    if (transportMode === 'console') {
      process.stdout.write(`\n[EMAIL mock] para=${to} | asunto="${subject}"\n${text}\n\n`);
      return { id: 'console' };
    }
    const from = `${config.MAIL_DISPLAY_NAME} <${fromAddress()}>`;
    if (transportMode === 'resend') {
      const { data, error } = await resendClient.emails.send({ from, to, subject, html, text });
      if (error) throw Object.assign(new Error(error.message || 'Error Resend'), { response: { data: error }, statusCode: error.statusCode });
      return { id: data?.id };
    }
    const info = await smtpTransporter.sendMail({ from, to, subject, html, text });
    return { id: info.messageId };
  } catch (err) {
    const classified = classifySendError(err);
    lastError = classified;
    const fatal = FATAL_CODES.has(classified.code);
    if (fatal) {
      transportMode = null;
      initPromise = null;
    }
    throw Object.assign(new Error(classified.message), { code: classified.code, fatal });
  }
}

function getStatus() {
  return { ready: Boolean(transportMode), transportMode, lastError, validation: validateEmailConfig() };
}

module.exports = { send, ensureInitialized, getStatus, validateEmailConfig, classifySendError };
