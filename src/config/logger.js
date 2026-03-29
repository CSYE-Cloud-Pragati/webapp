const { createLogger, format, transports } = require('winston');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), override: true });

// Use a different log file path for local development vs. production.
// For production, we now write logs to /opt/csye6225/logs/webapp.log.
const logFilePath = process.env.NODE_ENV === 'production'
  ? '/opt/csye6225/logs/webapp.log'  // EC2/AMI production path
  : './logs/webapp.log';             // Local development and test path

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
