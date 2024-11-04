const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');
const multer = require('multer');
const { User, Image } = require('../models');
const StatsD = require('node-statsd');
require('dotenv').config();

const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const bucket_name = process.env.bucket_name;
const statsdClient = new StatsD({ host: process.env.STATSD_HOST || 'localhost', port: 8125 });
let instanceId = 'localhost';

async function fetchInstanceId() {
    // Instance ID fetching code...
}

fetchInstanceId();

const logMetric = (metricName, value, unit = 'Milliseconds') => {
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

router.use((req, res, next) => {
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

// Route for profile picture upload
router.post('/user/self/pic', async (req, res) => {
    try {
        const uploadParams = {
            Bucket: bucket_name,
            Key: `user-profile-pics/${req.user.id}/${Date.now()}-${req.file.originalname}`,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };
        const data = await timedOperation(() => s3.upload(uploadParams).promise(), 'S3Upload');
        res.status(201).json({ imageUrl: data.Location });
    } catch (error) {
        res.status(500).json({ error: 'Error uploading profile picture' });
    }
});

module.exports = router;
