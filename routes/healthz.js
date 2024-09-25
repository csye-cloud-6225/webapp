const express = require('express');
const router = express.Router();
const sequelize = require('../config/database'); // Import the DB connection

// Health check endpoint for HEAD requests
router.head('/', async (req, res) => {
  try {
    await sequelize.authenticate(); // Check database connection
    // If connected, return 405 Method Not Allowed
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(405).send(); // 405 Method Not Allowed
  } catch (error) {
    console.error('Database connection error:', error);
    res.set('Cache-Control', 'no-cache'); // Disable caching
    return res.status(503).send(); // 503 Service Unavailable if DB connection fails
  }
});

// Health check endpoint for OPTIONS requests
router.options('/', async (req, res) => {
    try {
      await sequelize.authenticate(); // Check database connection
      // If connected, return 405 Method Not Allowed
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(405).send(); // 405 Method Not Allowed
    } catch (error) {
      console.error('Database connection error:', error);
      res.set('Cache-Control', 'no-cache'); // Disable caching
      return res.status(503).send(); // 503 Service Unavailable if DB connection fails
    }
  });
  

// Health check endpoint for GET requests without a payload
router.get('/', async (req, res) => {
  try {
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
