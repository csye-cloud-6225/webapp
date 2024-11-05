
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
     // Log count metric for each operation
    logMetric(`${metricPrefix}_Count`, 1, 'Count');  // Only in timedOperation

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

router.get('/', async (req, res) => {
    console.log("Received /healthz request", req.headers, req.query);

    // Immediately respond with 200 for ELB health checks
    if (req.headers['user-agent'] === 'ELB-HealthChecker/2.0') {
        console.log("ELB Health check detected, returning 200 OK");
        return res.status(200).send(); // 200 OK for ELB health checks
    }

    await timedOperation(async () => {
        try {
            // Step 1: Check for query parameters and log them
            if (Object.keys(req.query).length > 0) {
                console.log("Returning 400 due to presence of query parameters:", req.query);
                return res.status(400).send(); // 400 Bad Request if query parameters are present
            }

            // Step 2: Define allowed headers and log them
            const allowedHeaders = ['user-agent', 'accept', 'host', 'accept-encoding', 'connection', 'postman-token'];
            console.log("Allowed Headers:", allowedHeaders);

            // Step 3: Extract request headers and log them
            const requestHeaders = Object.keys(req.headers);
            console.log("Request Headers:", requestHeaders);

            // Step 4: Identify any disallowed headers and log them
            const disallowedHeaders = requestHeaders.filter(header => !allowedHeaders.includes(header));
            console.log("Disallowed Headers:", disallowedHeaders);

            // Step 5: Return 400 if any disallowed headers are present
            if (disallowedHeaders.length > 0) {
                console.log("Returning 400 due to disallowed headers:", disallowedHeaders);
                res.set({
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'X-Content-Type-Options': 'nosniff'
                });
                return res.status(400).send(); // 400 Bad Request
            }

            // Step 6: Attempt database connection and log success or failure
            await sequelize.authenticate();
            console.log("Database connected successfully, returning 200 OK");
            res.set('Cache-Control', 'no-cache'); // Disable caching
            return res.status(200).send(); // 200 OK if database connection is successful

        } catch (error) {
            // Step 7: Log any database connection errors and return 503
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
