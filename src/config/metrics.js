const StatsD = require('hot-shots');

const metricsClient = new StatsD({
  host: '127.0.0.1', 
  port: 8125,
  errorHandler: (error) => {
    console.error("StatsD Error:", error);
  }
});

module.exports = metricsClient;
