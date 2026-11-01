// Local fixtures include public development passwords and must never populate a
// production or remote database, even when a seed script is invoked manually.
module.exports = function assertLocalSeedAllowed() {
    const path = require('path');
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
    if (process.env.ALLOW_SAMPLE_DATA !== 'true' || !['development', 'test'].includes(process.env.NODE_ENV) ||
        !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost')) {
        throw new Error('Local data seeding requires ALLOW_SAMPLE_DATA=true, NODE_ENV=development or test, and a loopback DB_HOST. Production provisioning uses db:migrate and db:bootstrap-admin.');
    }
};
