const { createLogger, format, transports } = require('winston');

// Use a different log file path for local development.
const logFilePath = process.env.NODE_ENV === 'test'
  ? './logs/myapp.log'  // Relative path for local dev
  : '/opt/csye6225/logs/myapp.log'; // Production path

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
