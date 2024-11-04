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
// Initialize instance metadata token and ID
let metadataToken = null;
let tokenExpirationTime = null;

// Function to refresh the metadata token if needed
// async function getMetadataToken() {
//     const currentTime = Date.now();
//     if (metadataToken && currentTime < tokenExpirationTime) {
//         return metadataToken;
//     }

//     try {
//         const response = await axios.put(
//             'http://169.254.169.254/latest/api/token',
//             null,
//             { headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' } }
//         );
//         metadataToken = response.data;
//         tokenExpirationTime = currentTime + 21600 * 1000;
//         return metadataToken;
//     } catch (error) {
//         console.warn("Could not retrieve IMDSv2 token. Using 'localhost' as Instance ID.");
//         return null;
//     }
// }

// // Function to retrieve the instance ID using IMDSv2
// async function fetchInstanceId() {
//     try {
//         const token = await getMetadataToken();
//         if (!token) return;

//         const instanceResponse = await axios.get(
//             'http://169.254.169.254/latest/meta-data/instance-id',
//             { headers: { 'X-aws-ec2-metadata-token': token } }
//         );
//         instanceId = instanceResponse.data;
//         logToFile(`Fetched Instance ID: ${instanceId}`);
//     } catch (error) {
//         console.warn("Could not retrieve Instance ID. Using 'localhost' as fallback.");
//     }
// }

// // Fetch instance ID at startup
// fetchInstanceId();
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
    // console.log(`API Hit: ${req.method} ${req.path}`);
    // Create a consistent metric name
    const metricName = `API_${req.method}_${req.path.replace(/\//g, '_')}`;
    statsdClient.increment(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}.count`);
    // Log count metric to CloudWatch
    logMetric(`${metricName}_Count`, 1, 'Count');
    res.on('finish', () => {
        const duration = Date.now() - start;
        logMetric(`${metricName}_ExecutionTime`, duration);
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
