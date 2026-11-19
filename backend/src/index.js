process.env.TZ = process.env.TZ || 'America/Argentina/Buenos_Aires';

const { config } = require('./config');
const { createApp } = require('./app');
const outbox = require('./services/email/outbox');
const emailEngine = require('./services/email/engine');
const logger = require('./lib/logger');

async function main() {
  if (config.MOCK_MODE) {
    const { seedMock, DEMO } = require('./mock/seed');
    await seedMock();
    logger.info('modo_mock', { demoDni: DEMO.dni, demoPassword: DEMO.password });
  }
  await emailEngine.ensureInitialized();
  outbox.iniciarWorker();

  const server = createApp().listen(config.PORT, () => logger.info('servidor_iniciado', { port: config.PORT, mock: config.MOCK_MODE }));

  const shutdown = () => {
    outbox.detenerWorker();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('arranque_fallido', { message: err.message });
  process.exit(1);
});
