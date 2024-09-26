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
      // If there are query parameters, return 400 Bad Request
      return res.status(400).json(); // 400 Bad Request
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

module.exports = router;
