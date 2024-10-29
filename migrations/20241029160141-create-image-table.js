'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('images', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            userId: {
                type: Sequelize.UUID, // Changed to UUID to match Users table
                allowNull: false,
                references: {
                    model: 'Users', // Ensure this matches the casing of your Users table
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            profilePicUrl: { // Changed field names to match your model
                type: Sequelize.STRING,
                allowNull: false,
            },
            profilePicOriginalName: { // Changed field names to match your model
                type: Sequelize.STRING,
                allowNull: false,
            },
            profilePicUploadedAt: { // Changed field names to match your model
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
                allowNull: false,
            },
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('images');
    },
};
