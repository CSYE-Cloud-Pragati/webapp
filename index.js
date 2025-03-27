require('dotenv').config();

const express = require('express');
const sequelize = require('./src/config/database');
const HealthCheck = require('./src/models/healthCheck');
const fileRoutes = require("./src/routes/file");
const AWS = require("aws-sdk");

// Import the Winston logger and StatsD metrics client (NEW for metrics)
const logger = require('./src/config/logger');
logger.info("Application has started");

const metrics = require('./src/config/metrics');

const app = express();
const port = process.env.PORT || 8080;

// Only synchronize database if not in test mode
if (process.env.NODE_ENV !== 'test') {
  sequelize.sync({ force: true })
    .then(() => logger.info('Database synchronized!'))
    .catch((error) => logger.error('Error synchronizing database:', error));
}

// Middleware to catch JSON parsing errors
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      logger.warn("Invalid JSON body, returning 400");
      return res.status(400).send();
    }
    next();
  });
});

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

app.head('/healthz', (req, res) => {
  logger.info("HEAD /healthz: 405 Method Not Allowed");
  // Set consistent headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(405).send(); // Empty body
});

// GET /healthz
app.get('/healthz', async (req, res) => {
  const startTime = Date.now();
  logger.info("GET /healthz: Checking request for query/body/auth");
  // Set required headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // If any request parameters, body, or auth headers are provided, return 400.
  if (
    Object.keys(req.body).length > 0 ||
    Object.keys(req.query).length > 0 ||
    (req.get("Content-Length") && parseInt(req.get("Content-Length")) > 0) ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    logger.warn("GET /healthz: Rejected - extra request data present");
    return res.status(400).send();
  }

  try {
    logger.info("GET /healthz: Attempting a simple DB operation");
    // Attempt a simple DB operation
    await HealthCheck.create({});
    const duration = Date.now() - startTime;
    // Record custom metrics for health check (NEW for metrics)
    metrics.increment('api.healthz.count');
    metrics.timing('api.healthz.duration', duration);
    logger.info("GET /healthz: DB operation succeeded, returning 200");
    return res.status(200).send();
  } catch (error) {
    logger.error("GET /healthz: DB operation failed, returning 503", error);
    metrics.increment('api.healthz.error');
    return res.status(503).send();
  }
});

// For any method on /healthz that is not GET, return 405
app.all('/healthz', (req, res) => {
  logger.info(`ALL /healthz: 405 Method Not Allowed (method: ${req.method})`);
  // Set the same headers for consistency
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(405).send();
});

// Use file routes for /v1/file endpoints
app.use("/v1/file", fileRoutes);

// Catch-all for any undefined endpoints
app.get('*', (req, res) => {
  logger.warn(`GET ${req.originalUrl}: 404 Not Found`);
  res.status(404).send();
});

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
