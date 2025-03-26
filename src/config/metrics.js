// src/config/metrics.js
const StatsD = require('hot-shots');
// Create a StatsD client pointing to localhost:8125 (default for CloudWatch Agent StatsD listener)
const metricsClient = new StatsD({
  host: '127.0.0.1', // CloudWatch Agent runs on the same instance
  port: 8125,
  errorHandler: (error) => {
    console.error("StatsD Error:", error);
  }
});

module.exports = metricsClient;
