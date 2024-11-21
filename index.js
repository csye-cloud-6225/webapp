const AWS = require('aws-sdk');
const fs = require('fs');
const axios = require('axios');
const express = require('express');
const dotenv = require('dotenv');
const StatsD = require('node-statsd');
const sequelize = require('./config/database'); // Database connection setup
const healthzRoutes = require('./routes/healthz'); // Route handlers for health check
const userRoutes = require('./routes/user'); // Import user routes
const path = require('path');

const app = express();
const port = 8080;
dotenv.config(); // Load environment variables from .env file

// Set up CloudWatch and region configuration
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const cloudwatch = new AWS.CloudWatch();


// Initialize StatsD client only if not in test environment
const statsdClient = process.env.NODE_ENV !== 'test' ? new StatsD({ host: 'localhost', port: 8125 }) : { timing: () => {}, increment: () => {} };

// Ensure logs directory and app.log file exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
const logFilePath = path.join(logsDir, 'app.log');
if (!fs.existsSync(logFilePath)) fs.writeFileSync(logFilePath, ''); // Create an empty log file if it doesn't exist

// Setup logging to app.log
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
const logToFile = (message) => {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    logStream.write(logMessage);
    
};
// Initialize instance metadata token and ID
let instanceId = 'localhost';

// Function to retrieve the instance ID using IMDSv2
async function fetchInstanceId() {
    try {
        // Get the IMDSv2 token
        const tokenResponse = await axios.put(
            'http://169.254.169.254/latest/api/token',
            null,
            { headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } }
        );

        const token = tokenResponse.data;

        // Use the token to fetch the instance ID
        const instanceResponse = await axios.get(
            'http://169.254.169.254/latest/meta-data/instance-id',
            { headers: { 'X-aws-ec2-metadata-token': token } }
        );

        instanceId = instanceResponse.data;
        logToFile(`Fetched Instance ID: ${instanceId}`);
    } catch (error) {
        console.warn("Could not retrieve Instance ID. Using 'localhost' as fallback.");
    }
}

// Fetch instance ID at startup
fetchInstanceId();

// Utility function to log CloudWatch metrics
const logMetric = (metricName, value, unit = 'Milliseconds') => {
  if (process.env.NODE_ENV === 'test') return;

  const params = {
      MetricData: [
          {
              MetricName: metricName,
              Dimensions: [{ Name: 'InstanceId', Value: instanceId || 'localhost' }],
              Unit: unit,
              Value: value
          }
      ],
      Namespace: 'WebAppMetrics'
  };
  cloudwatch.putMetricData(params, (err) => {
      if (err) logToFile(`Failed to push metric ${metricName}: ${err}`);
      else logToFile(`Metric ${metricName} pushed successfully`);
  });
};
// Middleware to track API response time and log to CloudWatch and StatsD
app.use((req, res, next) => {
    const start = Date.now();
    // Increment the count of API hits in CloudWatch
    logMetric(`API-${req.method}-${req.path}-Count`, 1, 'Count');
    // console.log(`API Hit: ${req.method} ${req.path}`);
    statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`API-${req.method}-${req.path}`, duration);
        statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}`, duration);
        logToFile(`Request to ${req.method} ${req.path} took ${duration} ms`);
  
    });
    next();
});
let dbConnected = false;

// Function to check database connection and log status
const checkDatabaseConnection = async () => {
    try {
        const start = Date.now();
        await sequelize.authenticate();
        const dbDuration = Date.now() - start;
        logMetric('DBConnectionTime', dbDuration);
        statsdClient.timing('db.connection.time', dbDuration);

        if (!dbConnected) {
            logToFile('Database connected...');
            dbConnected = true;
        }
    } catch (error) {
        if (dbConnected) {
            logToFile(`Unable to connect to the database: ${error.message}`);
            dbConnected = false;
        }
    }
};

// Check database connection on startup and at intervals
checkDatabaseConnection();
if (process.env.NODE_ENV !== 'test') {
    setInterval(checkDatabaseConnection, 2000); // Check every 2 seconds
}

// Sync Sequelize schema and log errors to CloudWatch
sequelize.sync({ force: true })
    .then(() => logToFile('Database synchronized successfully'))
    .catch(err => {
        logToFile(`Detailed Error: ${JSON.stringify(err, null, 2)}`);
        logMetric('DBSyncError', 1, 'Count');
    });


// Use express.json() to handle JSON payloads
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      logToFile(`Bad JSON Request: ${err.message}`);
      return res.status(400).end();
  }
  next();
});
// Sync database schema with models
sequelize.sync({ alter: true })
  .then(() => {
    logToFile('Database synchronized successfully');
    console.log('Database synchronized successfully');
  })
  .catch((error) => {
    logToFile(`Error synchronizing the database: ${error}`);
    console.error('Error synchronizing the database:', error);
  });

// Middleware to check DB connection for each request
const checkDbConnection = async (req, res, next) => {
  try {
    await sequelize.authenticate(); // Verifies database connection
    next(); 
  } catch (error) {
    logToFile('Database connection failed');
    return res.status(503).send(); // Return 503 if the database connection fails
  }
};

// Apply the database connection check before handling routes
app.use(checkDbConnection);

// API endpoint routes
app.use('/healthz', healthzRoutes);
app.use('/cicd', healthzRoutes);
app.use('/v1', userRoutes);

// Handle unsupported HTTP methods for the /healthz endpoint
app.all('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(405).send(); // Return 405 for unsupported methods
});

// Custom 404 handler for unknown routes
app.use((req, res) => {
  logToFile(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json(); // Return a JSON error response for unmatched routes
});

// Start the server and listen on the specified port if this is the main module
if (require.main === module) {
  app.listen(port, () => {
    logToFile(`Server is up and running at http://localhost:${port}`);
    console.log(`Server is up and running at http://localhost:${port}`);
  });
}

module.exports = app; // Export the app for testing
