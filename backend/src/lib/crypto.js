const crypto = require('crypto');
const { config } = require('../config');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

const randomCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

const hashCode = (code, scope) =>
  crypto.createHmac('sha256', config.secrets.codePepper).update(`${scope}:${code}`).digest('hex');

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const opaqueKey = crypto.createHash('sha256').update(config.secrets.opaqueId).digest();

/** Id opaco para la UI: AES-256-GCM de un payload ligado a la cuenta. */
function sealId(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', opaqueKey, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

function openId(token) {
  try {
    const buf = Buffer.from(String(token), 'base64url');
    if (buf.length < 29) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', opaqueKey, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { sha256, randomToken, randomCode, hashCode, safeEqual, sealId, openId };
