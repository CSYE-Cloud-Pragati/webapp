const { createLogger, format, transports } = require('winston');

// Use a different log file path for local development vs. production.
// For production, we now write logs to /opt/csye6225/logs/webapp.log.
const logFilePath = process.env.NODE_ENV === 'test'
  ? './logs/myapp.log'  // Relative path for local testing
  : '/opt/csye6225/logs/webapp.log'; // Production path

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: logFilePath })
  ]
});

module.exports = logger;
