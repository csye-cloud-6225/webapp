const express = require('express');
const dotenv = require('dotenv');
const sequelize = require('./config/database'); // Database connection setup
const healthzRoutes = require('./routes/healthz'); // Route handlers for APIs

const app = express();
const port = 8080;

dotenv.config(); // Load environment variables from .env file

// Ensures database is accessible for each request
const checkDbConnection = async (req, res, next) => {
  try {
    await sequelize.authenticate(); // Verifies database connection
    next(); 
  } catch (error) {
    return res.status(503).send(); // Return 503 if the database connection fails
  }
};

// Blocks non-GET requests that include a payload
app.use((req, res, next) => {
  if (req.headers['content-length'] > 0) {
    return res.status(400).send(); // Return 400 for non-GET requests with a body
  }
  next();
});

// Apply the database connection check before handling routes
app.use(checkDbConnection);

// API endpoint routes
app.use('/healthz', healthzRoutes);

// Handle unsupported HTTP methods for the /healthz endpoint
app.all('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(405).send(); // Return 405 for unsupported methods
});

// Handle 404 for unknown routes with an empty body
app.use((req, res) => {
  res.status(404).send(); // Return 404 with no body content
});

// Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server is up and running at http://localhost:${port}`);
});