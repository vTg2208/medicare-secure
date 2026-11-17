const assert = require('node:assert/strict');
const request = require('supertest');
const { generateTotp } = require('../../src/services/totp.service');
const { decryptSecret } = require('../../src/services/encryption.service');

async function loginWithMfa(app, db, email, password, { trace = false } = {}) {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.DB_HOST, '127.0.0.1');
    assert.match(email, /@[^@]+\.invalid$/);
    const post = (path, body, ticket) => {
        const pending = request(app).post(`/api/auth${path}`).set('X-Auth-Transport', 'bearer');
        if (ticket) pending.set('X-Auth-Challenge', ticket);
        if (trace) pending.set('X-Performance-Trace', '1');
        return pending.send(body);
    };
    const passwordResponse = await post('/login', { email, password });
    if (passwordResponse.status !== 200) return { passwordResponse, sessionResponse: passwordResponse };
    const { ticket, nextStep } = passwordResponse.body.data;
    assert.ok(ticket, 'password authentication must remain restricted');
    let sessionResponse;
    if (nextStep === 'enroll') {
        const setup = await post('/mfa/setup', {}, ticket);
        assert.equal(setup.status, 200, JSON.stringify(setup.body));
        const confirmed = await post('/mfa/setup/confirm', { code: generateTotp(setup.body.data.secret) }, ticket);
        assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
        sessionResponse = await post('/mfa/setup/acknowledge', {}, ticket);
    } else {
        assert.equal(nextStep, 'verify');
        const row = (await db.query('SELECT m.* FROM user_mfa m JOIN users u ON u.id=m.user_id WHERE u.email=$1', [email])).rows[0];
        // These authorization fixtures simulate a later authenticator counter
        // without sleeping. The strict MFA suite separately tests replay rejection.
        await db.query('UPDATE user_mfa SET last_totp_step=-1 WHERE user_id=$1', [row.user_id]);
        const secret = decryptSecret(row.secret_cipher, `mfa/${row.user_id}`);
        sessionResponse = await post('/mfa/verify', { code: generateTotp(secret) }, ticket);
    }
    return { passwordResponse, sessionResponse };
}
module.exports = { loginWithMfa };
