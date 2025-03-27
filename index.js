require('dotenv').config();
const express = require('express');
const sequelize = require('./src/config/database');
const HealthCheck = require('./src/models/healthCheck');
const fileRoutes = require("./src/routes/file");
const AWS = require("aws-sdk");
const logger = require('./src/config/logger');
const metrics = require('./src/config/metrics');

const app = express();
const port = process.env.PORT || 8080;

app.use((req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});

if (process.env.NODE_ENV !== 'test') {
  sequelize.sync({ force: true })
    .then(() => logger.info('Database synchronized!'))
    .catch((error) => logger.error('Error synchronizing database:', error));
}

app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      logger.warn("Invalid JSON body");
      return res.status(400).send();
    }
    next();
  });
});

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

app.head('/healthz', (req, res) => {
  logger.info("HEAD /healthz not allowed");
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(405).send();
});

app.get('/healthz', async (req, res) => {
  const startTime = Date.now();
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
    logger.warn("/healthz request has extra headers or body");
    return res.status(400).send();
  }

  try {
    const dbStartTime = Date.now();
    await HealthCheck.create({});
    metrics.timing('api.healthz.db_duration', Date.now() - dbStartTime);

    metrics.increment('api.healthz.count');
    metrics.timing('api.healthz.duration', Date.now() - startTime);
    return res.status(200).send();
  } catch (error) {
    logger.error("/healthz DB operation failed:", error);
    metrics.increment('api.healthz.error');
    return res.status(503).send();
  }
});

app.all('/healthz', (req, res) => {
  logger.info(`/healthz disallowed method ${req.method}`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(405).send();
});

app.use("/v1/file", fileRoutes);

app.get('*', (req, res) => {
  logger.warn(`404 Not Found: ${req.originalUrl}`);
  res.status(404).send();
});

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;