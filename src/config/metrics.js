// src/config/metrics.js
const StatsD = require('hot-shots');
const metricsClient = new StatsD({
  host: '127.0.0.1',  // CloudWatch Agent listens locally on port 8125
  port: 8125,
  errorHandler: (error) => {
    console.error("StatsD Error:", error);
  }
});
module.exports = metricsClient;
