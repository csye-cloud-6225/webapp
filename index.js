const dotenv = require('dotenv');
const express = require('express');
const { Sequelize } = require('sequelize');

const app = express();
const port = 8080;
dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.USER, process.env.PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

// Authenticate database connection
sequelize.authenticate()
  .then(() => console.log('Connection established successfully.'))
  .catch((error) => console.error(error));

// Middleware to parse JSON requests
app.use(express.json());

// Middleware to reject any request with a payload
app.use((req, res, next) => {
    if ((req.headers['content-length'] > 0)) {
        // Reject requests with a payload for non-GET requests
        return res.status(400).send();
    }
    next();
});

// Health check endpoint for HEAD requests
app.head('/healthz', (req, res) => {
    // Return 405 Method Not Allowed for HEAD requests
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(405).send(); // 405 Method Not Allowed
});


// Health check endpoint for GET requests without a payload

app.get('/healthz', async (req, res) => {
    try {
        // Check database connection
        await sequelize.authenticate();
        res.set('Cache-Control', 'no-cache'); // Disable caching for the response
        return res.status(200).send(); // 200 OK if the DB connection is successful
    } catch (error) {
        console.error('Database connection error:', error);
        res.set('Cache-Control', 'no-cache'); // Disable caching for the response
        return res.status(503).send(); // 503 Service Unavailable if the DB connection fails
    }
});


// Handle unsupported methods for /healthz
app.all('*', (req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    // Return 405 for all other methods
    res.status(405).send(); // Send status 405 for unsupported methods
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
