const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
function check(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) check(file);
        else if (file.endsWith('.js')) {
            const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
            if (result.status) { process.stderr.write(result.stderr); process.exitCode = 1; }
        }
    }
}
check(path.resolve(__dirname, '../src'));
check(__dirname);
if (!process.exitCode) console.log('Backend JavaScript syntax checks passed');
