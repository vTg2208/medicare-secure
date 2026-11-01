const { createBackup } = require('./backup-helper');

if (require.main === module) createBackup({ output: process.argv[2] }).then(result => {
    process.stdout.write(`Encrypted backup created: ${result.output}; ${result.files} encrypted upload files\n`);
}).catch(error => { process.stderr.write(`Backup failed: ${error.message}\n`); process.exitCode = 1; });

module.exports = { createBackup };
