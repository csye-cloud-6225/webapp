const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
const StatsD = require('node-statsd');
const sequelize = require('../config/database'); // Import the DB connection

// Configure AWS SDK globally with the region from environment variables
AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1', // Default to 'us-east-1' if AWS_REGION is not set
});

// Configure AWS S3
const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket_name = process.env.bucket_name;
const statsdClient = new StatsD({ host: process.env.STATSD_HOST || 'localhost', port: 8125 });

// Utility function to log metrics to CloudWatch
const logMetric = (metricName, value, unit = 'Milliseconds') => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.warn(`Skipping metric ${metricName} due to missing AWS credentials.`);
        return;
    }

    const params = {
        MetricData: [
            {
                MetricName: metricName,
                Dimensions: [{ Name: 'InstanceId', Value: process.env.INSTANCE_ID || 'localhost' }],
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

const timedOperation = async (operation, metricPrefix) => {
    const start = Date.now();
    const result = await operation();
    const duration = Date.now() - start;
    logMetric(`${metricPrefix}_ExecutionTime`, duration);
    statsdClient.timing(`${metricPrefix}.execution_time`, duration);
    return result;
};

// Middleware to time API calls and increment count in StatsD
router.use((req, res, next) => {
    const start = Date.now();
    console.log(`API Hit: ${req.method} ${req.path}`);
    statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`API_${req.method}_${req.path}_ExecutionTime`, duration);
        statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.execution_time`, duration);
    });
    next();
});

// API endpoint for HEAD requests
router.head('/', async (req, res) => {
    await timedOperation(async () => {
        try {
            await sequelize.authenticate(); // Check database connection
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(405).send(); // 405 Method Not Allowed
        } catch (error) {
            console.error('Database connection error:', error);
            res.set('Cache-Control', 'no-cache'); // Disable caching
            return res.status(503).send(); // 503 Service Unavailable if DB connection fails
        }
    }, 'HEAD_Health');
});

// API endpoint for OPTIONS requests
router.options('/', async (req, res) => {
    await timedOperation(async () => {
        try {
            await sequelize.authenticate(); // Check database connection
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            return res.status(405).send(); // 405 Method Not Allowed
        } catch (error) {
            console.error('Database connection error:', error);
            res.set('Cache-Control', 'no-cache'); // Disable caching
            return res.status(503).send(); // 503 Service Unavailable if DB connection fails
        }
    }, 'OPTIONS_Health');
});

// API endpoint for GET requests
router.get('/', async (req, res) => {
    await timedOperation(async () => {
        try {
            // Check for query parameters
            if (Object.keys(req.query).length > 0) {
                return res.status(400).send(); // 400 Bad Request
            }

            // Allow specific headers or at least ensure we don't block known safe headers
            const allowedHeaders = ['user-agent', 'accept', 'host', 'accept-encoding', 'connection', 'postman-token'];
            const requestHeaders = Object.keys(req.headers);
            
            // Check for additional headers that are not in allowedHeaders
            const disallowedHeaders = requestHeaders.filter(header => !allowedHeaders.includes(header));

            if (disallowedHeaders.length > 0) {
                res.set({
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'X-Content-Type-Options': 'nosniff'
                });
                return res.status(400).send(); // 400 Bad Request if disallowed headers are present
            }

            await sequelize.authenticate(); // Check database connection
            res.set('Cache-Control', 'no-cache'); // Disable caching
            return res.status(200).send(); // 200 OK
        } catch (error) {
            console.error('Database connection error:', error);
            res.set('Cache-Control', 'no-cache'); // Disable caching
            return res.status(503).send(); // 503 Service Unavailable
        }
    }, 'GET_Health');
});

// Handle unsupported HTTP methods for the /healthz endpoint
router.all('/', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(405).send(); // Return 405 for unsupported methods
});

module.exports = router;
