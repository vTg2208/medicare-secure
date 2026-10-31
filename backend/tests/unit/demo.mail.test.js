const { execFileSync } = require('node:child_process');

const inspectMail = (demo) => JSON.parse(execFileSync(process.execPath, ['-e', `
    const mock = (name, exports) => {
        const id = require.resolve(name);
        require.cache[id] = { id, filename: id, loaded: true, exports };
    };
    const calls = { create: 0, verify: 0, send: 0 };
    mock('nodemailer', { createTransport() {
        calls.create++;
        return { verify() { calls.verify++; }, async sendMail() { calls.send++; return { messageId: 'fixture' }; } };
    } });
    mock('./src/utils/logger', { info() {}, warn() {}, error() {} });
    const mail = require('./src/config/mail');
    (async () => {
        for (const send of [() => mail.sendEmail({ to: 'fixture@example.test', subject: 'Fixture' }), () => mail.sendOTPEmail('fixture@example.test', '123456')]) {
            try { await send(); } catch (err) { calls.error = { statusCode: err.statusCode, code: err.code }; }
        }
        process.stdout.write(JSON.stringify(calls));
    })();
`], { cwd: require('node:path').resolve(__dirname, '../..'), env: { ...process.env, NODE_ENV: 'production', DEMO_MODE: demo }, encoding: 'utf8' }));

it('never creates an SMTP transport on import or sends mail in demo mode and throws explicit 503', () => {
    expect(inspectMail('true')).toEqual({ create: 0, verify: 0, send: 0, error: { statusCode: 503, code: 'DEMO_FEATURE_DISABLED' } });
});
it('preserves production SMTP verification and delivery when demo mode is false', () => {
    expect(inspectMail('false')).toEqual({ create: 1, verify: 1, send: 2 });
});
