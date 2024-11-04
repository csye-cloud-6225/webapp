const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const StatsD = require('node-statsd');
const sequelize = require('../config/database');

AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const statsdClient = new StatsD({ host: process.env.STATSD_HOST || 'localhost', port: 8125 });
let instanceId = 'localhost';

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


// Function to time operations (e.g., database connection checks)
const timedOperation = async (operation, metricPrefix) => {
    const start = Date.now();
    const result = await operation();
    const duration = Date.now() - start;
    logMetric(`${metricPrefix}_ExecutionTime`, duration);
    statsdClient.timing(`${metricPrefix}.execution_time`, duration);
    return result;
};

// Middleware to track API counts and response time for the health check endpoint
router.use((req, res, next) => {
    const start = Date.now();
    const metricName = `API_${req.method}_${req.path.replace(/\//g, '_')}`;

    // Log count metric to CloudWatch and increment StatsD counter
    logMetric(`${metricName}_Count`, 1, 'Count');
    statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`${metricName}_ExecutionTime`, duration);
        statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.execution_time`, duration);
    });
    next();
});

// Health check endpoint
router.get('/', async (req, res) => {
    await timedOperation(async () => {
        try {
            // Check database connection
            await sequelize.authenticate();
            res.status(200).send(); // 200 OK if database is connected
        } catch (error) {
            console.error('Database connection error:', error);
            res.status(503).send(); // 503 Service Unavailable if DB connection fails
        }
    }, 'GET_Health');
});

// Handle unsupported HTTP methods for the /healthz endpoint
router.all('/', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(405).send(); // Return 405 for unsupported methods
});

module.exports = router;
