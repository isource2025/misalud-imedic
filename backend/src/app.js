const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { config } = require('./config');
const rl = require('./middleware/rateLimit');
const { csrfProtection } = require('./middleware/csrf');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const emailEngine = require('./services/email/engine');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' }
    })
  );
  // El front llama al back a través del rewrite /api de Next.js (mismo origen), así que no se habilita CORS.
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', rl.general);

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, servicio: 'misalud-backend', mock: config.MOCK_MODE, email: emailEngine.getStatus().ready ? 'listo' : 'no_listo' })
  );

  app.use('/api', csrfProtection);
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api', require('./routes/clinico.routes'));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
