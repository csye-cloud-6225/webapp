// migrations/202XXXXXX-create-image.js

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
            userId: { // Updated to match the model field name
                type: Sequelize.UUID,
                allowNull: false,
                // Foreign key constraint
                references: {
                    model: 'Users', // Adjusted to match the model reference
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            profilePicUrl: { // Updated field name to match the model
                type: Sequelize.STRING,
                allowNull: false,
            },
            originalName: { // Updated field name to match the model
                type: Sequelize.STRING,
                allowNull: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW,
            },
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('images');
    },
};
