const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust the path as necessary

class Image extends Model {}

Image.init({
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Users', // Ensure this matches the casing of your Users table
            key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
    },
    profilePicUrl: { // Using profilePicUrl for consistency
        type: DataTypes.STRING,
        allowNull: false,
    },
    profilePicOriginalName: { // Keeping this field for the original file name
        type: DataTypes.STRING,
        allowNull: false,
    },
    profilePicUploadedAt: { // Keeping this field for the upload date
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    sequelize,
    modelName: 'Image',
    tableName: 'images',
});

// Removed Image.sync(), as migrations should manage the creation of tables

module.exports = Image;
