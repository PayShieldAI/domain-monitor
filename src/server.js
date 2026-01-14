const app = require('./app');
const config = require('./config');
const { validateConfig } = require('./config');
const { createPool, closePool } = require('./config/database');
const logger = require('./utils/logger');

async function start() {
  try {
    // Validate configuration
    validateConfig();
    logger.info({ env: config.env }, 'Configuration validated');

    // Initialize database connection pool
    createPool();
    logger.info('Database pool initialized');

    // Start server
    const server = app.listen(config.port, () => {
      logger.info({ port: config.port }, 'Server started');
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Shutdown signal received');

      server.close(async () => {
        logger.info('HTTP server closed');

        await closePool();
        logger.info('Database connections closed');

        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error({ error: err.message }, 'Failed to start server');
    process.exit(1);
  }
}

start();
