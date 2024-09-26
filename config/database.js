// config/database.js
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME, 
  process.env.USER, 
  process.env.PASSWORD, 
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

// Authenticate DB connection
sequelize.authenticate()
  .then(() => console.log('Connection established successfully.'))
  .catch((error) => console.error('Unable to connect to the database:'));

module.exports = sequelize;