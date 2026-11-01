const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withApplication } = require('./helpers/application-fixture');

test('persisted messaging respects patient ownership, current care and durable evidence', { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000 }, async t => withApplication('messages', async ({ db, people, call }) => {
    let thread;
    await t.test('only current consenting care relationships are offered as contacts', async () => {
        const contacts = await call('patient', 'GET', '/messages/contacts');
        assert.deepEqual(contacts.data.map(row => row.id).sort(), [people.doctor.id, people.nurse.id].sort());
        await call('patient', 'POST', '/messages/threads', { recipientId: people.otherDoctor.id }, 403);
        await call('admin', 'GET', '/messages/threads', undefined, 403);
    });
    await t.test('patient starts a conversation and physician reads and replies after a fresh request', async () => {
        thread = (await call('patient', 'POST', '/messages/threads', { recipientId: people.doctor.id }, 201)).data;
        assert.equal((await call('patient', 'POST', '/messages/threads', { recipientId: people.doctor.id }, 201)).data.id, thread.id);
        await call('patient', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'Synthetic confidential question' }, 201);
        const physician = await call('doctor', 'GET', `/messages/threads/${thread.id}/messages`);
        assert.equal(physician.data.messages[0].body, 'Synthetic confidential question');
        await call('doctor', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'Synthetic clinician reply' }, 201);
        const patient = await call('patient', 'GET', `/messages/threads/${thread.id}/messages`);
        assert.deepEqual(patient.data.messages.map(message => message.body), ['Synthetic confidential question', 'Synthetic clinician reply']);
        const stored = (await db.query('SELECT body_cipher FROM care_messages')).rows;
        assert.equal(stored.length, 2);
        assert.ok(stored.every(row => !row.body_cipher.includes('Synthetic')));
        assert.equal((await db.query("SELECT COUNT(*)::int count FROM audit_logs WHERE metadata::text LIKE '%confidential question%'")).rows[0].count, 0);
    });
    await t.test('outsiders cannot read, send, or spoof a sender', async () => {
        await call('otherPatient', 'GET', `/messages/threads/${thread.id}/messages`, undefined, 404);
        await call('otherDoctor', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'Intrusion' }, 404);
        await call('patient', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'Spoofed', senderId: people.doctor.id }, 400);
        await call('patient', 'POST', `/messages/threads/${thread.id}/messages`, { body: ' ' }, 400);
        await call('patient', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'x'.repeat(4001) }, 400);
    });
    await t.test('the patient information copy includes their correspondence without ciphertext or unrelated messages', async () => {
        const { hashPassword } = require('../src/services/encryption.service');
        await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword('Synthetic-password-123!'), people.patient.id]);
        const information = (await call('patient', 'POST', '/privacy/export', { currentPassword: 'Synthetic-password-123!' })).data;
        assert.deepEqual(information.careMessages.map(row => row.body), ['Synthetic confidential question', 'Synthetic clinician reply']);
        assert.ok(information.careMessages.every(row => !Object.hasOwn(row, 'body_cipher')));
    });
    await t.test('audit failure rolls back a message instead of reporting delivery', async () => {
        await db.query("CREATE FUNCTION reject_fixture_message_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='send_care_message' THEN RAISE EXCEPTION 'Fixture audit unavailable'; END IF; RETURN NEW; END $$");
        await db.query('CREATE TRIGGER reject_fixture_message_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_fixture_message_audit()');
        try {
            await call('patient', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'Must roll back' }, 503);
            assert.equal((await db.query('SELECT COUNT(*)::int count FROM care_messages')).rows[0].count, 2);
        } finally { await db.query('DROP TRIGGER reject_fixture_message_audit ON audit_logs'); }
    });
    await t.test('revocation blocks providers immediately while the patient keeps their history', async () => {
        await db.query("UPDATE consents SET status='revoked' WHERE patient_id=$1 AND recipient_user_id=$2", [people.patient.id, people.doctor.id]);
        assert.equal((await call('doctor', 'GET', '/messages/threads')).data.length, 0);
        await call('doctor', 'GET', `/messages/threads/${thread.id}/messages`, undefined, 403);
        await call('patient', 'POST', `/messages/threads/${thread.id}/messages`, { body: 'Not authorized' }, 403);
        assert.equal((await call('patient', 'GET', `/messages/threads/${thread.id}/messages`)).data.messages.length, 2);
    });
}));
