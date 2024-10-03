const mysql = require('mysql2/promise');

async function setupTestDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root', // Replace with your MySQL username
      password: 'Parna.coM001' // Replace with your MySQL password
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS test_db');
    console.log('Test database created or already exists');

    await connection.query('USE test_db');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        firstName VARCHAR(255) NOT NULL,
        lastName VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        account_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        account_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created or already exists');

  } catch (error) {
    console.error('Error setting up test database:', error);
  } finally {
    if (connection) await connection.end();
  }
}

setupTestDatabase();