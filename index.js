'use strict';
const bcrypt = require('bcrypt'); // Add bcrypt for password hashing
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // A user can have only one image (profile picture)
      User.hasOne(models.Image, { // Change to hasOne for one profile picture
        foreignKey: 'userId', // Foreign key in the Image table
        as: 'profilePicture', // Alias for the association
        onDelete: 'CASCADE', // Delete the profile picture if the user is deleted
      });
    }
  }

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Auto-generate UUIDs
      primaryKey: true, // Set as primary key
      allowNull: false,
    },
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
    },
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'Users',

    hooks: {
      beforeCreate: async (user, options) => {
        // Hash password before creating the user
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      },
      beforeUpdate: async (user, options) => {
        if (user.changed('password')) {
          // Hash password before updating if it was changed
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
        // Update the account_updated timestamp
        user.account_updated = new Date();
      }
    }
  });

  // Define the Image model here
  class Image extends Model {
    static associate(models) {
      // Each image belongs to a single user
      Image.belongsTo(models.User, {
        foreignKey: 'userId', // Foreign key in the User table
        as: 'user', // Optional alias for easier access
      });
    }
  }

  Image.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID, // Foreign key to match the User table
      allowNull: false,
      references: {
        model: 'Users', // Ensure this matches the casing of your Users table
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    profilePicUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profilePicOriginalName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profilePicUploadedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
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
    modelName: 'Image',
    tableName: 'images',
  });

  return { User, Image };
};
