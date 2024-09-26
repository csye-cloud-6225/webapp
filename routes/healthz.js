const express = require('express');
const router = express.Router();
const sequelize = require('../config/database'); // Import the DB connection

// API endpoint for HEAD requests
router.head('/', async (req, res) => {
  try {
    await sequelize.authenticate(); // Check database connection
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(405).send(); // 405 Method Not Allowed
  } catch (error) {
    console.error('Database connection error:', error);
    res.set('Cache-Control', 'no-cache'); // Disable caching
    return res.status(503).send(); // 503 Service Unavailable if DB connection fails
  }
});

// API endpoint for OPTIONS requests
router.options('/', async (req, res) => {
  try {
    await sequelize.authenticate(); // Check database connection
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(405).send(); // 405 Method Not Allowed
  } catch (error) {
    console.error('Database connection error:', error);
    res.set('Cache-Control', 'no-cache'); // Disable caching
    return res.status(503).send(); // 503 Service Unavailable if DB connection fails
  }
});

// API endpoint for GET requests
router.get('/', async (req, res) => {
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
});


// Handle unsupported HTTP methods for the /healthz endpoint
router.all('/', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(405).send(); // Return 405 for unsupported methods
});

module.exports = router;
