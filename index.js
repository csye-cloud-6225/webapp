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
const s3 = new AWS.S3();

// Initialize StatsD client only if not in test environment
const statsdClient = process.env.NODE_ENV !== 'test' ? new StatsD({ host: 'localhost', port: 8125 }) : { timing: () => {}, increment: () => {} };

let instanceId = 'localhost';

// Function to retrieve the instance ID
// Function to retrieve the instance ID using IMDSv2
async function fetchInstanceId() {
    if (process.env.NODE_ENV === 'test') {
        instanceId = 'localhost'; // Use 'localhost' in test environment without warning
        return;
    }

    try {
        const tokenResponse = await axios.put(
            'http://169.254.169.254/latest/api/token',
            null,
            { headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } }
        );

        const token = tokenResponse.data;

        const instanceResponse = await axios.get(
            'http://169.254.169.254/latest/meta-data/instance-id',
            { headers: { 'X-aws-ec2-metadata-token': token } }
        );

        instanceId = instanceResponse.data;
    } catch (error) {
        console.warn("Could not retrieve Instance ID. Using 'localhost' as fallback.");
    }
}

// Fetch instance ID at startup
fetchInstanceId();

// Utility function to log metrics to CloudWatch
const logMetric = (metricName, value, unit = 'Milliseconds') => {
    // Skip metric logging if in test environment or if credentials are missing
    if (process.env.NODE_ENV === 'test' || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.warn(`Skipping metric ${metricName} due to missing AWS credentials or test environment.`);
        return;
    }

    const params = {
        MetricData: [
            {
                MetricName: metricName,
                Dimensions: [{ Name: 'InstanceId', Value: instanceId || 'localhost' }],
                Unit: unit,
                Value: value,
            },
        ],
        Namespace: 'WebAppMetrics',
    };

    const cloudwatch = new AWS.CloudWatch();
    cloudwatch.putMetricData(params, (err) => {
        if (err) console.error(`Failed to push metric ${metricName}: ${err}`);
    });
};


// Middleware to track API call counts and response time
app.use((req, res, next) => {
    const start = Date.now();
    const metricName = `API_${req.method}_${req.path.replace(/\//g, '_')}`;
    
    logMetric(`${metricName}_Count`, 1, 'Count');
    statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`${metricName}_ExecutionTime`, duration);
        statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.execution_time`, duration);
    });
    next();
});
// Use express.json() to handle JSON payloads
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      logToFile(`Bad JSON Request: ${err.message}`);
      return res.status(400).end();
  }
  next();
})
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
// Middleware to check database connection
const checkDatabaseConnection = async () => {
    try {
        const start = Date.now();
        await sequelize.authenticate();
        const dbDuration = Date.now() - start;
        logMetric('DBConnectionTime', dbDuration);
        statsdClient.timing('db.connection.time', dbDuration);
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
};

// Check database connection on startup
checkDatabaseConnection();

app.use('/healthz', healthzRoutes);
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
  
  
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server is up and running at http://localhost:${port}`);
    });
}

module.exports = app;
