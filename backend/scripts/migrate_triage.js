const { main } = require('../src/database/migrate');
main().catch(error => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
