'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize'); // Import Sequelize and DataTypes
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {}; // Object to hold the models

// Initialize the Sequelize instance
const sequelize = config.use_env_variable
  ? new Sequelize(process.env[config.use_env_variable], config) // Use environment variable for DB connection
  : new Sequelize(config.database, config.username, config.password, config); // Use config for DB connection

// Read model files and initialize them
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      !file.includes('.test.js') // Exclude test files
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes); // Pass sequelize instance and DataTypes
    db[model.name] = model; // Store the model in the db object
  });

// Associate models if applicable
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Attach sequelize instance to the exported object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export the models and sequelize instance
module.exports = db;
