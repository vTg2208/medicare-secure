const { execFileSync } = require('node:child_process');
const path = require('node:path');

const inspectMail = (configured, mode = 'production') => JSON.parse(execFileSync(process.execPath, ['-e', `
    const mock = (name, exports) => {
        const id = require.resolve(name);
        require.cache[id] = { id, filename: id, loaded: true, exports };
    };
    const calls = { create: 0, verify: 0, send: 0 };
    mock('nodemailer', { createTransport(options) {
        calls.create++;
        calls.options = options;
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
`], { cwd: path.resolve(__dirname, '../..'), env: {
    NODE_ENV: mode,
    ...(configured && { EMAIL_HOST: 'smtp.example.test', EMAIL_FROM: 'medicare@example.test' }),
}, encoding: 'utf8', timeout: 10000 }));

it('creates no transport and returns a service error when SMTP is absent', () => {
    expect(inspectMail(false)).toEqual({ create: 0, verify: 0, send: 0, error: { statusCode: 503, code: 'EMAIL_UNAVAILABLE' } });
});
it('verifies and uses the configured production SMTP host', () => {
    expect(inspectMail(true)).toMatchObject({ create: 1, verify: 1, send: 2, options: { host: 'smtp.example.test', requireTLS: true, tls: {rejectUnauthorized:true,minVersion:'TLSv1.2'} } });
});
it('uses an offline JSON transport only in tests', () => {
    expect(inspectMail(false, 'test')).toEqual({ create: 1, verify: 0, send: 2, options: { jsonTransport: true } });
});
