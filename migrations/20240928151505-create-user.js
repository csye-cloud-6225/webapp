'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Ensures email is unique
        validate: {
          isEmail: true // Ensures valid email format
        }
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      account_created: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW // Automatically set when user is created
      },
      account_updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW // Automatically set when user is created, updated with hooks
      },
      profilePicUrl: {
        type: Sequelize.STRING, // Add the fileName field
        allowNull: true, // Optional field
      },
      profilePicUploadedAt: {
        type: Sequelize.DATE, // Add the url field
        allowNull: true, // Optional field
      },
      profilePicOriginalName: {
        type: DataTypes.STRING,
        allowNull: true, // Allow null if no profile picture is uploaded
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });
  },
  
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Users');
  }
};
