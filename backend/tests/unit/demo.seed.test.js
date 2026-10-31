const { execFileSync } = require('node:child_process');
const path = require('node:path');

it('does not let DEMO_MODE bypass the production demo-seed guard', () => {
    const output = execFileSync(process.execPath, ['-e', `
        try {
            require('./src/database/demo-seed-guard')();
            process.stdout.write('allowed');
        } catch { process.stdout.write('rejected'); }
    `], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, NODE_ENV: 'production', DEMO_MODE: 'true', ALLOW_DEMO_SEED: 'true', DB_HOST: '127.0.0.1' },
        encoding: 'utf8',
    });
    expect(output).toBe('rejected');
});
