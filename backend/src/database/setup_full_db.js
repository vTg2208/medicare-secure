// Production setup applies tracked migrations only. Demo data is always opt-in.
const { main } = require('./migrate');
if (require.main === module) main().catch(error => { console.error(`Database setup failed: ${error.message}`); process.exitCode = 1; });
module.exports = { setupFullDatabase: main };
