const { execFileSync } = require('node:child_process');
const path = require('node:path');

const seedAllowed = env => execFileSync(process.execPath, ['-e', `
    try { require('./src/database/local-seed-guard')(); process.stdout.write('allowed'); }
    catch { process.stdout.write('rejected'); }
`], { cwd: path.resolve(__dirname, '../..'), env, encoding: 'utf8', timeout: 10000 });

it.each([
    { NODE_ENV: 'production', ALLOW_SAMPLE_DATA: 'true', DB_HOST: '127.0.0.1' },
    { NODE_ENV: 'development', ALLOW_SAMPLE_DATA: 'true', DB_HOST: 'remote.example.test' },
    { NODE_ENV: 'development', DB_HOST: '127.0.0.1' },
])('rejects unsafe local fixture provisioning %#', env => {
    expect(seedAllowed(env)).toBe('rejected');
});
it('allows explicit provisioning only against a local development database', () => {
    expect(seedAllowed({ NODE_ENV: 'test', ALLOW_SAMPLE_DATA: 'true', DB_HOST: '127.0.0.1' })).toBe('allowed');
});
