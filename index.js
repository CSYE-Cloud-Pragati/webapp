require('dotenv').config(); 

const express = require('express');
const sequelize = require('./src/config/database');
const HealthCheck = require('./src/models/healthCheck');
const fileRoutes = require("./src/routes/file");
const AWS = require("aws-sdk");

const app = express();
const port = process.env.PORT || 8080;

// Only synchronize database if not in test mode
if (process.env.NODE_ENV !== 'test') {
  sequelize.sync({ force: true })
    .then(() => console.log('Database synchronized!'))
    .catch((error) => console.error('Error synchronizing database:', error));
}

// Middleware to catch JSON parsing errors
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
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
    // If you want consistent headers, set them here:
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(405).send(); // Empty body
  });

// GET /healthz
app.get('/healthz', async (req, res) => {
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
    return res.status(400).send();
  }

  try {
    // Attempt a simple DB operation
    await HealthCheck.create({});
    return res.status(200).send();
  } catch (error) {
    return res.status(503).send();
  }
});

// For any method on /healthz that is not GET, return 405
app.all('/healthz', (req, res) => {
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
  res.status(404).send();
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;
