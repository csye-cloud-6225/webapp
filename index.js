const express = require('express');
const dotenv = require('dotenv');
const sequelize = require('./config/database'); // Import DB connection
const healthzRoutes = require('./routes/healthz'); // Import healthz routes

const app = express();
const port = 8080;

dotenv.config();

// Middleware to check database connection on every request
const checkDbConnection = async (req, res, next) => {
  try {
    await sequelize.authenticate(); // Check database connection
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.status(503).send(); // 503 Service Unavailable if DB is not connected
  }
};

// Middleware to reject requests with a payload for non-GET requests
app.use((req, res, next) => {
  if (req.headers['content-length'] > 0) {
    return res.status(400).send(); // Reject requests with a payload
  }
  next();
});

// Apply the DB connection check middleware
app.use(checkDbConnection);

// Health check routes
app.use('/healthz', healthzRoutes);

// Handle unsupported methods globally
app.all('*', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(405).send(); // 405 Method Not Allowed
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
