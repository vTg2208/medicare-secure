const { Pool, types } = require('pg');
const logger = require('../utils/logger');
const config = require('./env');

// Database configuration from environment variables
const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: String(config.database.password || ''),
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: config.database.ssl,
    statement_timeout: 15000,
    idle_in_transaction_session_timeout: 15000,
    application_name: 'healthcare-api',
});

// Test database connection
pool.on('connect', () => {
    logger.info('Database connection established');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error:', err);
    // Temporarily commented out to prevent silent crashes during debugging
    // process.exit(-1);
});

// Helper function to execute queries
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { duration, rows: result.rowCount });
        return result;
    } catch (error) {
        logger.error('Database query failed', { code: error.code });
        throw error;
    }
};

// Helper function for transactions
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Test connection function
const testConnection = async () => {
    try {
        const result = await query('SELECT NOW()');
        logger.info('Database connection test successful:', result.rows[0]);
        return true;
    } catch (error) {
        logger.error('Database connection test failed:', error);
        return false;
    }
};

module.exports = {
    pool,
    query,
    transaction,
    testConnection,
};
