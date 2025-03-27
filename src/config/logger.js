const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/var/log/myapp.log' }) // This writes logs to /var/log/myapp.log
  ]
});

module.exports = logger;
