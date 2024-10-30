const express = require('express');
const dotenv = require('dotenv');
const sequelize = require('./config/database'); // Database connection setup
const healthzRoutes = require('./routes/healthz'); // Route handlers for health check
const userRoutes = require('./routes/user'); // Import user routes
// Import the logger and metrics
const logger= require('./logs/logger');
// const logger = require('./logs/logger'); // Importing logger module
// const metrics = require('./metrics'); // Importing metrics module

const app = express();
const port = 8080;

dotenv.config(); // Load environment variables from .env file

// Use express.json() to handle JSON payloads
app.use(express.json());

// Sync database schema with models
sequelize.sync({ alter: true })
  .then(() => {
    logger.info('Database synchronized successfully');
    console.log('Database synchronized successfully');
  })
  .catch((error) => {
    logger.error('Error synchronizing the database:', error);
    console.error('Error synchronizing the database:', error);
  });

// Middleware to check DB connection for each request
const checkDbConnection = async (req, res, next) => {
  try {
    await sequelize.authenticate(); // Verifies database connection
    next(); 
  } catch (error) {
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
  res.status(404).json(); // Return a JSON error response for unmatched routes
});

// Start the server and listen on the specified port if this is the main module
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server is up and running at http://localhost:${port}`);
  });
}

module.exports = app; // Export the app for testing
