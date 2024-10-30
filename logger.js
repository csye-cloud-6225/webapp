const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');

// Create a Winston logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // File transport for local logging
    new winston.transports.File({ filename: '/opt/webapp/logs/app.log' }),

    // Console transport for development/testing
    new winston.transports.Console(),

    // CloudWatch transport for AWS logging
    new WinstonCloudWatch({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP,
      logStreamName: process.env.CLOUDWATCH_LOG_STREAM,
      awsRegion: process.env.AWS_REGION,
      jsonMessage: true,
      messageFormatter: ({ level, message, additionalInfo }) => JSON.stringify({ level, message, ...additionalInfo })
    })
  ],
  exitOnError: false
});

// Handle CloudWatch errors gracefully
logger.on('error', function(err) {
  console.error('CloudWatch logging error:', err);
});

module.exports = logger;
