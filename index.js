require('dotenv').config();

const express = require('express');
const sequelize = require('./src/config/database');
const HealthCheck = require('./src/models/healthCheck');
const fileRoutes = require("./src/routes/file");
const AWS = require("aws-sdk");

const logger = require('./src/config/logger');
const metrics = require('./src/config/metrics');

logger.info("Application initialization started");

const app = express();
const port = process.env.PORT || 8080;

// Global Request Logger
app.use((req, res, next) => {
  logger.info(`Incoming request: [${req.method}] ${req.originalUrl}`);
  metrics.increment(`requests.total`);
  next();
});

// DB Sync
if (process.env.NODE_ENV !== 'test') {
  sequelize.sync({ force: true })
    .then(() => logger.info('Database synchronized successfully'))
    .catch((error) => {
      logger.error('Error during database synchronization', error);
      metrics.increment('errors.db_sync');
    });
}

// JSON parser with error handling
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      logger.warn("⚠️ Malformed JSON body received, sending 400");
      metrics.increment('errors.invalid_json');
      return res.status(400).send();
    }
    next();
  });
});

// AWS SDK Config
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// HEAD /healthz
app.head('/healthz', (req, res) => {
  logger.info("HEAD /healthz is not allowed - 405 returned");
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(405).send();
});

// GET /healthz
app.get('/healthz', async (req, res) => {
  const startTime = Date.now();
  logger.info("Performing health check...");

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (
    Object.keys(req.body).length > 0 ||
    Object.keys(req.query).length > 0 ||
    (req.get("Content-Length") && parseInt(req.get("Content-Length")) > 0) ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    logger.warn("Health check failed: unexpected headers or body present");
    metrics.increment('errors.healthz.invalid_request');
    return res.status(400).send();
  }

  try {
    const dbStartTime = Date.now();
    await HealthCheck.create({});
    const dbDuration = Date.now() - dbStartTime;
    metrics.timing('api.healthz.db_write_duration', dbDuration);
    logger.info(`DB check completed in ${dbDuration} ms`);

    const apiDuration = Date.now() - startTime;
    metrics.increment('api.healthz.success');
    metrics.timing('api.healthz.total_duration', apiDuration);
    logger.info(`Health check successful in ${apiDuration} ms`);

    return res.status(200).send();
  } catch (error) {
    logger.error("Health check DB operation failed", error);
    metrics.increment('api.healthz.error');
    return res.status(503).send();
  }
});

// ALL /healthz - not allowed methods
app.all('/healthz', (req, res) => {
  logger.info(`Method [${req.method}] not allowed on /healthz - returning 405`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(405).send();
});

// Mount /v1/file routes
app.use("/v2/file", fileRoutes);

// Catch-all for unknown routes
app.get('*', (req, res) => {
  logger.warn(`Unhandled GET route accessed: ${req.originalUrl} - returning 404`);
  metrics.increment('errors.404');
  res.status(404).send();
});

// Start Server
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server listening on http://localhost:${port}`);
    metrics.increment('server.started');
  });
}

module.exports = app;
