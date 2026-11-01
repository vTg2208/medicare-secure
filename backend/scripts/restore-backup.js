const { restoreBackup } = require('./backup-helper');

if (require.main === module) restoreBackup({ input: process.argv[2], uploads: process.argv[3] }).then(result => {
    process.stdout.write(`Recovery drill completed: ${result.database}; ${result.files} encrypted upload files\n`);
}).catch(error => { process.stderr.write(`Restore failed: ${error.message}\n`); process.exitCode = 1; });

module.exports = { restoreBackup };
