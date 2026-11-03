const { Pool, types } = require('pg');
const logger = require('../utils/logger');
const config = require('./env');
const { getRequestContext } = require('../services/request-context');
const { recordAuditError } = require('../middleware/metrics');
const { measurePhase } = require('../services/request-timing');

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
        // Every request-bound statement uses a transaction-local identity. This
        // includes CTE writes without relying on a fragile SQL verb parser.
        const result = getRequestContext()
            ? await transaction(client => measurePhase('db_sql', () => client.query(text, params)))
            : await pool.query(text, params);
        const duration = Date.now() - start;
        logger.debug('Executed query', { duration, rows: result.rowCount });
        return result;
    } catch (error) {
        if (!getRequestContext() && error.code === 'P7501') recordAuditError();
        logger.error('Database query failed', { code: error.code });
        throw error;
    }
};

// Helper function for transactions
const transaction = async (callback, { isolationLevel } = {}) => {
    const beginnings = { 'read committed': 'BEGIN ISOLATION LEVEL READ COMMITTED',
        'repeatable read': 'BEGIN ISOLATION LEVEL REPEATABLE READ',
        serializable: 'BEGIN ISOLATION LEVEL SERIALIZABLE' };
    if (isolationLevel && !Object.prototype.hasOwnProperty.call(beginnings,isolationLevel)) throw new Error('Unsupported transaction isolation level');
    const client = await measurePhase('db_pool', () => pool.connect());
    try {
        await measurePhase('db_protocol', async () => {
            await client.query(isolationLevel ? beginnings[isolationLevel] : 'BEGIN');
            await applyRequestContext(client);
        });
        const result = await callback(client);
        await measurePhase('db_protocol', () => client.query('COMMIT'));
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === 'P7501') recordAuditError();
        throw error;
    } finally {
        client.release();
    }
};

const applyRequestContext = async (client) => {
    const context = getRequestContext();
    // Always clear local settings on explicit transactions too. SET LOCAL never
    // survives COMMIT/ROLLBACK or leaks the previous borrower of a pooled client.
    await client.query(`SELECT set_config('shms.actor_id',$1,true),
        set_config('shms.request_id',$2,true), set_config('shms.request_method',$3,true)`,
    [context?.actorId || '', context?.requestId || '', context?.method || '']);
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
    applyRequestContext,
    testConnection,
};
