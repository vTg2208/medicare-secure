require('dotenv').config();
const app = require('./app');
const { pool, testConnection } = require('./config/db');
const { assertSchemaReady } = require('./services/readiness.service');
const { startConsentScheduler } = require('./services/consent.scheduler');
const { initializeJobs } = require('./jobs/sessionCleanup.job');
const logger = require('./utils/logger');
const config = require('./config/env');

async function startServer() {
    if (!await testConnection()) throw new Error('Database is unavailable');
    await assertSchemaReady();
    const server = app.listen(config.port, () => logger.info(`Healthcare API listening on ${config.port}`));
    server.requestTimeout = 60000;
    server.headersTimeout = 65000;
    server.keepAliveTimeout = 5000;
    const tasks = [...startConsentScheduler(), ...initializeJobs()];
    let stopping = false;
    const shutdown = async (code = 0) => {
        if (stopping) return;
        stopping = true;
        for (const task of tasks) await task.stop();
        const deadline = setTimeout(() => process.exit(1), 10000).unref();
        server.close(async () => {
            try { await pool.end(); }
            finally { clearTimeout(deadline); logger.close(); process.exit(code); }
        });
        server.closeIdleConnections();
    };
    process.once('SIGINT', () => shutdown());
    process.once('SIGTERM', () => shutdown());
    process.once('uncaughtException', error => { logger.error('Fatal application error', { name: error.name }); shutdown(1); });
    process.once('unhandledRejection', () => { logger.error('Unhandled application rejection'); shutdown(1); });
    return server;
}
if (require.main === module) startServer().catch(error => {
    logger.error('Startup failed', { message: error.message });
    pool.end().finally(() => { process.exitCode = 1; });
});
module.exports = { startServer };
