'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true, // Ensures email is unique
        
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
      verification_token: {
        type: Sequelize.STRING,
        allowNull: true, // Token is optional and set only when needed
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false, // Default is not verified
      },
      verification_expiry: {
        type: Sequelize.DATE,
        allowNull: true, // Expiry time is optional
      },
      // Removed profilePicUrl fields since images are managed in a separate table
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