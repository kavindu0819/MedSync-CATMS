const mysql = require('mysql2/promise');

// Configuration matching your docker-compose.yml file
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3307, // Convert port string to number
  user: process.env.DB_USER || 'medsync_app',
  password: process.env.DB_PASSWORD || 'medsync_pass',
  database: process.env.DB_NAME || 'medsync',
  // Return DATE/DATETIME columns as plain strings ('2025-02-04') instead of JS
  // Dates. Without this mysql2 builds the Date at local midnight and JSON
  // serialises it as UTC, so every date arrives shifted back by 5h30m.
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool for efficient query handling
const pool = mysql.createPool(dbConfig);

// Function to test connection and run a sample query
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connected to Docker MySQL successfully!');

    // Verify database connection by fetching loaded tables
    const [rows] = await connection.query('SHOW TABLES;');
    console.log('📋 Tables found in medsync database:');
    console.log(rows);

    // Release connection back to pool
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

// Execute connection test
testConnection();

module.exports = pool;