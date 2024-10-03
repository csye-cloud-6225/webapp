'use strict';
const bcrypt = require('bcrypt'); // Add bcrypt for password hashing
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Define association here
    }
  }

  User.init({
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Ensure email is unique
      validate: {
        isEmail: true, // Ensure email format is valid
      },
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    account_created: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Automatically set current date
    },
    account_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Automatically set current date
    }
  }, {
    sequelize,
    modelName: 'User',

    // Use hooks to update account_updated field on every update
    hooks: {
      beforeCreate: async (user, options) => {
        // Log the incoming password before hashing
        console.log('Password before hashing (beforeCreate):', user.password);

        // Hash password before creating the user
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);

        // Log the hashed password
        console.log('Password after hashing (beforeCreate):', user.password);
      },
      beforeUpdate: async (user, options) => {
        if (user.changed('password')) {
          // Log the incoming password before hashing
          console.log('Password before hashing (beforeUpdate):', user.password);

          // Hash password before updating if it was changed
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);

          // Log the hashed password
          console.log('Password after hashing (beforeUpdate):', user.password);
        }
        // Update the account_updated timestamp
        user.account_updated = new Date();
      }
    }
  });

  return User;
};
