'use strict';
const { Model, DataTypes } = require('sequelize');
const Sequelize = require('../config/database')
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Each user has one image
      User.hasOne(models.Image, {
        foreignKey: 'userId', // Foreign key in the Image table
        as: 'image', // Optional alias for easier access
      });
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Add any additional fields for the User model here
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users', // Ensure this matches your actual table name
  });

  return User;
};
