const AWS = require('aws-sdk');
const fs = require('fs');
const express = require('express');
const dotenv = require('dotenv');
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
    console.log(logMessage); // Optional: also log to console
};

// Middleware to track API response time and log to CloudWatch and StatsD
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logToFile(`Request to ${req.method} ${req.path} took ${duration} ms`);
        statsdClient.timing(`api.${req.method.toLowerCase()}.${req.path.replace(/\//g, '_')}`, duration);
    });
    next();
});



// Use express.json() to handle JSON payloads
app.use(express.json());

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
