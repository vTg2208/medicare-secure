const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

test('MFA enrollment, recovery, throttling and security evidence are transactional', { timeout: 90000 }, async t => {
    const name = `mfa_fixture_${process.pid}`;
    delete process.env.MFA_ALLOW_LEGACY_TEST_SESSIONS;
    process.env.DB_NAME = name;
    assert.equal(process.env.RUN_DB_TESTS, 'true');
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.DB_HOST, '127.0.0.1');
    assert.notEqual(process.env.DB_PORT, '5432');
    // This isolated suite exercises the durable account/IP factor budgets.
    // Keep the shared HTTP limiter from combining unrelated subtest failures.
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS = '1000';
    process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
    const mfa = require('../src/services/mfa.service');
    assert.equal(typeof mfa.beginPasswordAuthentication, 'function', 'restricted password authentication must exist');
    const admin = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: 'postgres', user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${name}`);
    let db;
    const req = { ip: '127.0.0.1', headers: { origin: 'http://localhost:3000', 'user-agent': 'Synthetic MFA fixture' }, method: 'POST', path: '/api/auth/mfa' };
    const { generateTotp } = require('../src/services/totp.service');
    try {
        const migrationClient = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: name, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
        await migrationClient.connect();
        try { await require('../src/database/migrate').migrate(migrationClient, { log: () => {} }); } finally { await migrationClient.end(); }
        db = require('../src/config/db');
        await require('../scripts/governance-evidence').verifyCatalog(db,
            require('../../docs/compliance/data-inventory.json'));
        const account = async label => (await db.query("INSERT INTO users(email,password_hash,first_name,last_name,role_id,status,is_verified) VALUES($1,'synthetic-unused-hash',$2,'Fixture',(SELECT id FROM roles WHERE name='patient'),'active',true) RETURNING *", [`${label}@example.invalid`, label])).rows[0];
        const user = await account('mfa');
        let setup, recoveryCodes, issuedSession;
        await t.test('password tickets and confirmed setup cannot access full sessions before acknowledgment', async () => {
            const begun = await mfa.beginPasswordAuthentication(user, req);
            assert.equal(begun.nextStep, 'enroll');
            setup = await mfa.startSetup(begun.ticket, req);
            assert.match(setup.secret, /^[A-Z2-7]{32}$/);
            const verified = await mfa.confirmSetup(begun.ticket, generateTotp(setup.secret), req);
            recoveryCodes = verified.recoveryCodes;
            assert.equal(recoveryCodes.length, 10);
            assert.equal((await db.query('SELECT count(*)::integer AS count FROM sessions WHERE user_id=$1', [user.id])).rows[0].count, 0);
            assert.equal((await db.query('SELECT enabled_at FROM user_mfa WHERE user_id=$1', [user.id])).rows[0]?.enabled_at ?? null, null);
            const completed = await mfa.acknowledgeSetup(begun.ticket, req);
            issuedSession = completed.session;
            assert.ok(completed.session.token);
            const persisted = (await db.query('SELECT mfa_method,mfa_verified_at,csrf_hash FROM sessions WHERE user_id=$1', [user.id])).rows[0];
            assert.equal(persisted.mfa_method, 'totp'); assert.ok(persisted.mfa_verified_at); assert.match(persisted.csrf_hash, /^[a-f0-9]{64}$/);
            await assert.rejects(mfa.acknowledgeSetup(begun.ticket, req));
        });
        await t.test('concurrent valid challenges consume an authenticator time step only once', async () => {
            await db.query('UPDATE user_mfa SET last_totp_step=-1 WHERE user_id=$1', [user.id]);
            const begun = await mfa.beginPasswordAuthentication(user, req);
            assert.equal(begun.nextStep, 'verify');
            const outcomes = await Promise.allSettled([mfa.verifyChallenge(begun.ticket, generateTotp(setup.secret), req), mfa.verifyChallenge(begun.ticket, generateTotp(setup.secret), req)]);
            assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
        });
        await t.test('TOTP step-up needs a fresh factor proof bound to the current active session', async () => {
            assert.equal(typeof mfa.authorizeStepUp, 'function');
            await db.query('UPDATE user_mfa SET last_totp_step=-1 WHERE user_id=$1', [user.id]);
            await assert.rejects(mfa.authorizeStepUp(user.id, '11111111-1111-4111-8111-111111111111', generateTotp(setup.secret), req));
            const result = await mfa.authorizeStepUp(user.id, issuedSession.id, generateTotp(setup.secret), req);
            assert.ok(result.stepUpTicket);
            await assert.rejects(mfa.authorizeStepUp(user.id, issuedSession.id, generateTotp(setup.secret), req));
        });
        await t.test('recovery is single-use and cancellation preserves the active authenticator', async () => {
            const before = (await db.query('SELECT secret_cipher FROM user_mfa WHERE user_id=$1', [user.id])).rows[0].secret_cipher;
            const begun = await mfa.beginPasswordAuthentication(user, req);
            const recovered = await mfa.recoverChallenge(begun.ticket, recoveryCodes[0], req);
            assert.equal(recovered.nextStep, 'enroll');
            const replacement = await mfa.startSetup(begun.ticket, req);
            assert.notEqual(replacement.secret, setup.secret);
            assert.deepEqual((await db.query('SELECT secret_cipher FROM user_mfa WHERE user_id=$1', [user.id])).rows[0].secret_cipher, before);
            const another = await mfa.beginPasswordAuthentication(user, req);
            await assert.rejects(mfa.recoverChallenge(another.ticket, recoveryCodes[0], req));
            const denial=(await db.query("SELECT status_code FROM audit_logs WHERE user_id=$1 AND action='mfa_verification_failed' ORDER BY timestamp DESC LIMIT 1",[user.id])).rows[0];
            assert.equal(denial.status_code,401,'factor-denial evidence must record its HTTP outcome');
        });
        await t.test('new password tickets do not reset account guessing limits', async () => {
            const throttled = await account('throttle');
            const begin = await mfa.beginPasswordAuthentication(throttled, req);
            await mfa.startSetup(begin.ticket, req);
            for (let index = 0; index < 5; index++) {
                const next = index ? await mfa.beginPasswordAuthentication(throttled, req) : begin;
                if (index) await mfa.startSetup(next.ticket, req);
                await assert.rejects(mfa.confirmSetup(next.ticket, 'invalid', req));
            }
            await assert.rejects(mfa.beginPasswordAuthentication(throttled, req), error => error.status === 429);
        });
        await t.test('an audit failure rolls back activation, challenge consumption and session creation', async () => {
            const rollback = await account('rollback');
            const begun = await mfa.beginPasswordAuthentication(rollback, req);
            const pending = await mfa.startSetup(begun.ticket, req);
            await mfa.confirmSetup(begun.ticket, generateTotp(pending.secret), req);
            await db.query("CREATE FUNCTION reject_mfa_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='mfa_enrolled' THEN RAISE EXCEPTION 'Synthetic audit outage'; END IF; RETURN NEW; END $$");
            await db.query('CREATE TRIGGER reject_mfa_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_mfa_audit()');
            try {
                await assert.rejects(mfa.acknowledgeSetup(begun.ticket, req));
                assert.equal((await db.query('SELECT enabled_at FROM user_mfa WHERE user_id=$1', [rollback.id])).rows[0]?.enabled_at ?? null, null);
                assert.equal((await db.query('SELECT count(*)::integer AS count FROM sessions WHERE user_id=$1', [rollback.id])).rows[0].count, 0);
            } finally {
                await db.query('DROP TRIGGER reject_mfa_audit ON audit_logs'); await db.query('DROP FUNCTION reject_mfa_audit()');
            }
            assert.ok((await mfa.acknowledgeSetup(begun.ticket, req)).session.token);
        });
        await t.test('HTTP password login is restricted and full browser cookies enforce CSRF and revocation', async () => {
            const httpUser = await account('http-mfa');
            const password = 'Synthetic-Fixture-Password-123!';
            await db.query('UPDATE users SET password_hash=$2 WHERE id=$1', [httpUser.id, await require('bcrypt').hash(password, 4)]);
            const server = await new Promise(resolve => { const running = require('../src/app').listen(0, '127.0.0.1', () => resolve(running)); });
            const base = `http://127.0.0.1:${server.address().port}/api`;
            const call = (path, body, extra = {}) => fetch(base + path, { method: 'POST',
                headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', ...extra }, body: JSON.stringify(body) });
            try {
                const legacyToken = require('../src/config/jwt').generateAccessToken({ userId: httpUser.id });
                await db.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [httpUser.id, require('../src/services/encryption.service').hashToken(legacyToken)]);
                assert.equal((await fetch(base + '/auth/verify', { headers: { Authorization: `Bearer ${legacyToken}` } })).status, 401);
                const passwordResponse = await call('/auth/login', { email: httpUser.email, password });
                assert.equal(passwordResponse.status, 200);
                const restricted = await passwordResponse.json();
                assert.equal(restricted.data.nextStep, 'enroll');
                assert.equal(restricted.data.accessToken, undefined); assert.equal(restricted.token, undefined);
                assert.equal(passwordResponse.headers.get('set-cookie'), null);
                const headers = { 'X-Auth-Challenge': restricted.data.ticket };
                const setupResponse = await call('/auth/mfa/setup', {}, headers);
                assert.equal(setupResponse.status, 200);
                const enrolled = (await setupResponse.json()).data;
                assert.equal((await call('/auth/mfa/setup/confirm', { code: generateTotp(enrolled.secret) }, headers)).status, 200);
                const response = await call('/auth/mfa/setup/acknowledge', {}, headers);
                assert.equal(response.status, 200);
                const complete = await response.json(); assert.equal(complete.data.user.id, httpUser.id);
                assert.equal(complete.data.accessToken, undefined);
                const cookies = response.headers.getSetCookie();
                assert.ok(cookies.some(value => /^medicare_session=/.test(value) && /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)));
                const cookie = cookies.map(value => value.split(';')[0]).join('; ');
                const csrf = cookies.find(value => value.startsWith('medicare_csrf=')).split(';')[0].split('=')[1];
                assert.equal((await fetch(base + '/auth/verify', { headers: { Cookie: cookie } })).status, 200);
                assert.equal((await call('/auth/logout', {}, { Cookie: cookie })).status, 403);
                assert.equal((await call('/auth/logout', {}, { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://attacker.invalid' })).status, 403);
                const laterSession = await db.transaction(async client => require('../src/services/auth-session.service').issueFullSession(client,
                    await mfa.lockAccount(client, httpUser.id), 'totp', req));
                const delayedLogout = await call('/auth/logout', {}, { Cookie: cookie, 'X-CSRF-Token': csrf });
                assert.equal(delayedLogout.status, 200);
                const staleRead = await fetch(base + '/auth/verify', { headers: { Cookie: cookie } });
                assert.equal(staleRead.status, 401);
                // Apply the old responses after a new cookie issuance, as a browser jar does.
                const jar = new Map([['medicare_session', laterSession.token], ['medicare_csrf', laterSession.csrfToken]]);
                for (const stale of [delayedLogout, staleRead]) for (const header of stale.headers.getSetCookie()) {
                    const [name, value] = header.split(';')[0].split('=');
                    if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(header)) jar.delete(name); else jar.set(name, value);
                }
                assert.equal(jar.get('medicare_session'), laterSession.token, 'late responses must not clear the current cookie jar');
                assert.equal((await fetch(base + '/auth/verify', { headers: { Cookie: [...jar].map(([name,value]) => `${name}=${value}`).join('; ') } })).status, 200);
                assert.equal((await db.query('SELECT is_active FROM sessions WHERE id=$1', [laterSession.id])).rows[0].is_active, true,
                    'a delayed cookie logout must not revoke a later sign-in');
            } finally { await new Promise(resolve => server.close(resolve)); }
        });
        await t.test('verified passkeys issue full sessions and reject absent verification, wrong origins and replay', async () => {
            const passkeyUser = await account('passkey');
            const key = require('./helpers/webauthn-fixture').authenticator();
            await db.query('INSERT INTO passkey_credentials(user_id,credential_id,public_key,counter) VALUES($1,$2,$3,0)', [passkeyUser.id, key.credentialId, key.cose]);
            const server = await new Promise(resolve => { const running = require('../src/app').listen(0, '127.0.0.1', () => resolve(running)); });
            const base = `http://127.0.0.1:${server.address().port}/api/auth/passkey`;
            const call = (path, body, extra = {}) => fetch(base + path, { method: 'POST',
                headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', ...extra }, body: JSON.stringify(body) });
            try {
                const options = async () => {
                    const response = await call('/login/options', { email: passkeyUser.email });
                    assert.equal(response.status, 200);
                    const data = (await response.json()).data;
                    assert.equal(data.userVerification, 'required'); assert.ok(data.challengeId);
                    return data;
                };
                for (const invalid of [{ verified: false }, { origin: 'https://attacker.invalid' }]) {
                    const challenge = await options();
                    assert.equal((await call('/login/verify', { email: passkeyUser.email, challengeId: challenge.challengeId,
                        credential: key.assertion(challenge.challenge, invalid) })).status, 401);
                }
                const challenge = await options();
                const body = { email: passkeyUser.email, challengeId: challenge.challengeId, credential: key.assertion(challenge.challenge) };
                const response = await call('/login/verify', body); assert.equal(response.status, 200);
                const complete = await response.json(); assert.equal(complete.data.user.id, passkeyUser.id); assert.ok(complete.data.stepUpTicket);
                assert.equal(complete.data.accessToken, undefined);
                assert.equal((await call('/login/verify', body)).status, 401);
                const cookies = response.headers.getSetCookie(), cookie = cookies.map(value => value.split(';')[0]).join('; ');
                const csrf = cookies.find(value => value.startsWith('medicare_csrf=')).split(';')[0].split('=')[1];
                const headers = { Cookie: cookie, 'X-CSRF-Token': csrf };
                assert.equal((await call('/register/options', {}, headers)).status, 403, 'a session alone cannot add a factor');
                const registration = await call('/register/options', {}, { ...headers, 'X-MFA-Step-Up': complete.data.stepUpTicket });
                assert.equal(registration.status, 200);
                assert.equal((await registration.json()).data.authenticatorSelection.userVerification, 'required');
                assert.equal((await call('/register/options', {}, { ...headers, 'X-MFA-Step-Up': complete.data.stepUpTicket })).status, 403);
                assert.equal((await db.query("SELECT count(*)::integer AS count FROM sessions WHERE user_id=$1 AND mfa_method='passkey'", [passkeyUser.id])).rows[0].count, 1);
                const sessionId = (await db.query('SELECT id FROM sessions WHERE user_id=$1', [passkeyUser.id])).rows[0].id;
                const freshProof = await db.transaction(async client => mfa.createChallenge(client,
                    await mfa.lockAccount(client, passkeyUser.id), 'stepup', { operation: 'passkey_register', sessionId }));
                await db.query('UPDATE sessions SET is_active=false WHERE id=$1', [sessionId]);
                // Emulate revocation committing after the request's authentication middleware.
                let status = 200;
                const raceResponse = { status(value) { status = value; return this; }, json() {} };
                await require('../src/modules/auth/passkey.controller').registerOptions({ ...req,
                    user: { id: passkeyUser.id }, session: { id: sessionId },
                    headers: { ...req.headers, 'x-mfa-step-up': freshProof }, body: {} }, raceResponse);
                assert.equal(status, 403, 'factor registration rechecks revocation inside its transaction');
            } finally { await new Promise(resolve => server.close(resolve)); }
        });
        await t.test('phone-only passkeys retain sign-in and authenticated step-up', async () => {
            const person = await account('phone-passkey');
            const phone = '+15550001001';
            await db.query('UPDATE users SET email=NULL,phone=$2 WHERE id=$1', [person.id, phone]);
            const key = require('./helpers/webauthn-fixture').authenticator();
            await db.query('INSERT INTO passkey_credentials(user_id,credential_id,public_key,counter) VALUES($1,$2,$3,0)', [person.id,key.credentialId,key.cose]);
            const request = require('supertest'), app = require('../src/app');
            const post = (path,body) => request(app).post(`/api/auth/passkey/${path}`).set('Origin','http://localhost:3000').send(body);
            const options = await post('login/options',{email:phone});
            assert.equal(options.status,200);
            const proof = options.body.data;
            const verified = await post('login/verify',{email:phone,challengeId:proof.challengeId,credential:key.assertion(proof.challenge)});
            assert.equal(verified.status,200);
            assert.equal(verified.body.data.user.id,person.id);
            const cookies = verified.headers['set-cookie'].map(value => value.split(';')[0]).join('; ');
            const csrf = verified.headers['set-cookie'].find(value => value.startsWith('medicare_csrf=')).split(';')[0].split('=')[1];
            const step = await request(app).post('/api/auth/passkey/step-up/options').set('Origin','http://localhost:3000')
                .set('Cookie',cookies).set('X-CSRF-Token',csrf).send({});
            assert.equal(step.status,200);
        });
        await t.test('public passkey traffic cannot evict recovery or spend its protected guessing budget', async () => {
            const person = await account('public-flood');
            const begun = await mfa.beginPasswordAuthentication(person, req);
            const setup = await mfa.startSetup(begun.ticket,req);
            const confirmed = await mfa.confirmSetup(begun.ticket,generateTotp(setup.secret),req);
            await mfa.acknowledgeSetup(begun.ticket,req);
            const recovery = await mfa.beginPasswordAuthentication(person,req);
            await mfa.recoverChallenge(recovery.ticket,confirmed.recoveryCodes[0],req);
            const key = require('./helpers/webauthn-fixture').authenticator();
            await db.query('INSERT INTO passkey_credentials(user_id,credential_id,public_key,counter) VALUES($1,$2,$3,0)',[person.id,key.credentialId,key.cose]);
            const request = require('supertest'), app = require('../src/app');
            const publicRequest = (path,body) => request(app).post(`/api/auth/passkey/${path}`).set('Origin','http://localhost:3000').send(body);
            for (let i=0;i<5;i++) {
                const options = await publicRequest('login/options',{email:person.email}); assert.equal(options.status,200);
                const proof=options.body.data;
                assert.equal((await publicRequest('login/verify',{email:person.email,challengeId:proof.challengeId,credential:{id:key.credentialId}})).status,401);
            }
            assert.ok((await mfa.startSetup(recovery.ticket,req)).secret);
            assert.ok((await mfa.beginPasswordAuthentication(person,req)).ticket);
            assert.ok((await db.query('SELECT count(*)::int AS n FROM auth_challenges WHERE user_id=$1',[person.id])).rows[0].n<=4);
            let limited=false;
            for(let i=0;i<21;i++) if((await publicRequest('login/options',{email:person.email})).status===429){limited=true;break;}
            assert.equal(limited,true,'successful public options also consume their independent request budget');
            assert.ok((await mfa.startSetup(recovery.ticket,req)).secret);
        });
        await t.test('derived passkey authorization never extends the accepted factor deadline', async () => {
            const person=await account('freshness');
            const begun=await mfa.beginPasswordAuthentication(person,req);
            const setup=await mfa.startSetup(begun.ticket,req);
            await mfa.confirmSetup(begun.ticket,generateTotp(setup.secret),req);
            const deadline=new Date(Date.now()+60000).toISOString();
            await db.query("UPDATE auth_challenges SET payload=jsonb_set(payload,'{proofExpiresAt}',to_jsonb($2::text)) WHERE token_hash=$1",[require('../src/services/encryption.service').hashToken(begun.ticket),deadline]);
            const full=await mfa.acknowledgeSetup(begun.ticket,req);
            const step=(await db.query('SELECT * FROM auth_challenges WHERE token_hash=$1',[require('../src/services/encryption.service').hashToken(full.stepUpTicket)])).rows[0];
            assert.ok(step.expires_at.getTime()<=Date.parse(deadline));
            const controller=require('../src/modules/auth/passkey.controller'); let result;
            await controller.registerOptions({...req,user:{id:person.id},session:{id:full.session.id},headers:{...req.headers,'x-mfa-step-up':full.stepUpTicket},body:{}},
                {status(code){this.code=code;return this;},json(value){result=value;}});
            assert.ok(result.data.challengeId);
            const registration=(await db.query('SELECT expires_at FROM auth_challenges WHERE token_hash=$1',[require('../src/services/encryption.service').hashToken(result.data.challengeId)])).rows[0];
            assert.ok(registration.expires_at.getTime()<=Date.parse(deadline));
        });
    } finally {
        if (db) await db.pool.end();
        await admin.query(`DROP DATABASE ${name} WITH (FORCE)`); await admin.end();
    }
});
