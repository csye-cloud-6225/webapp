'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Image extends Model {
    static associate(models) {
      // Each image belongs to a single user
      Image.belongsTo(models.User, {
        foreignKey: 'userId', // This is the foreign key
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

  return Image;
};
