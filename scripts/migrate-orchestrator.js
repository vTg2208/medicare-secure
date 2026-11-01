#!/usr/bin/env node
const { main } = require('../backend/src/database/migrate');
main().catch(error => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
