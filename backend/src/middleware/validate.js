const { badRequest } = require('../lib/errors');

/** Valida req[part] con un esquema zod y lo reemplaza por el resultado parseado. */
const validate = (schema, part = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[part] ?? {});
  if (!r.success) {
    const campos = {};
    for (const issue of r.error.issues) campos[issue.path.join('.') || '_'] ??= issue.message;
    return next(badRequest('Revisá los datos ingresados.', 'VALIDACION', { campos }));
  }
  if (part === 'query') req.validQuery = r.data;
  else req[part] = r.data;
  next();
};

module.exports = { validate };
