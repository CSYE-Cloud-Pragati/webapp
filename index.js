require("dotenv").config();
const express = require("express");
const sequelize = require("./src/config/database");
const HealthCheck = require("./src/models/healthCheck");
const fileRoutes = require("./src/routes/file");
const AWS = require("aws-sdk");
const logger = require("./src/config/logger");
const metrics = require("./src/config/metrics");

const app = express();
const port = process.env.PORT || 8080;

app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.originalUrl} incoming request`);
  next();
});

if (process.env.NODE_ENV !== "test") {
  sequelize.sync({ force: true })
    .then(() => logger.info("Database sync completed successfully"))
    .catch((err) => logger.error("Database sync failed:", err));
}

app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      logger.warn("Malformed JSON received in request body");
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

app.get("/healthz", async (req, res) => {
  const startTime = Date.now();
  logger.info("[GET /healthz] Processing health check request");

  if (
    Object.keys(req.body).length > 0 ||
    Object.keys(req.query).length > 0 ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    logger.warn("[GET /healthz] Invalid health check request: extra data present");
    metrics.increment("api.healthz.invalid");
    return res.status(400).send();
  }

  try {
    const dbStart = Date.now();
    await HealthCheck.create({});
    const dbDuration = Date.now() - dbStart;
    metrics.timing("api.healthz.db_duration", dbDuration);

    const totalDuration = Date.now() - startTime;
    metrics.increment("api.healthz.count");
    metrics.timing("api.healthz.duration", totalDuration);

    logger.info(`[GET /healthz] Health check succeeded in ${totalDuration} ms`);
    return res.status(200).send();
  } catch (err) {
    logger.error("[GET /healthz] Database check failed", err);
    metrics.increment("api.healthz.failed");
    return res.status(503).send();
  }
});

app.use("/v1/file", fileRoutes);

app.use("*", (req, res) => {
  logger.warn(`Unhandled route: ${req.method} ${req.originalUrl}`);
  return res.status(404).send();
});

if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

module.exports = app;
