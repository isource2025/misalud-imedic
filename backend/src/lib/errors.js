class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const badRequest = (message, code = 'SOLICITUD_INVALIDA', extra) => new HttpError(400, code, message, extra);
const unauthorized = (message = 'Sesión inválida o vencida', code = 'NO_AUTENTICADO') =>
  new HttpError(401, code, message);
const forbidden = (message, code = 'PROHIBIDO') => new HttpError(403, code, message);
const notFound = (message = 'No encontrado', code = 'NO_ENCONTRADO') => new HttpError(404, code, message);
const gone = (message = 'Ya no está disponible', code = 'YA_NO_DISPONIBLE') => new HttpError(410, code, message);
const unprocessable = (message, code = 'NO_PROCESABLE', extra) => new HttpError(422, code, message, extra);

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, gone, unprocessable, asyncHandler };
