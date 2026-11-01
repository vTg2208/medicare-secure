const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { withApplication } = require('./helpers/application-fixture');
const { noticeFixture } = require('./helpers/privacy-notice-fixture');

test('published privacy notices preserve exact patient provenance without granting consent', { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 90000 }, async t => withApplication('notices', async ({ db, people, call }) => {
    const app = require('../src/app'); const fixture = noticeFixture(); let first;
    const consentCount = (await db.query('SELECT count(*)::int AS n FROM consents')).rows[0].n;
    await t.test('an unconfigured public installation reports no published notice and cannot fabricate a receipt', async () => {
        const response = await request(app).get('/api/notices/current');
        assert.equal(response.status, 200); assert.equal(response.body.data, null);
        await call('patient','POST','/notices/acknowledgements',{ versionId: crypto.randomUUID(), acknowledged: true },409);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM privacy_notice_acknowledgements')).rows[0].n, 0);
    });
    await t.test('publication and receipt administration enforce roles and reject forged input', async () => {
        assert.equal((await request(app).post('/api/notices/versions').send(fixture)).status,401);
        await call('patient','POST','/notices/versions',fixture,403);
        await call('doctor','GET','/notices/acknowledgements',undefined,403);
        await call('officer','POST','/notices/versions',{ ...fixture, publishedBy: people.patient.id },400);
        await call('officer','POST','/notices/versions',{ ...fixture, contactEmail: 'not an email' },400);
        await call('officer','POST','/notices/versions',{ ...fixture, sections: { ...fixture.sections, retention: '' } },400);
    });
    first = (await call('officer','POST','/notices/versions',fixture,201)).data;
    await t.test('public content has a stable digest and excludes private publication review notes', async () => {
        const current = await request(app).get('/api/notices/current'); assert.equal(current.status,200);
        assert.equal(current.body.data.id,first.id); assert.equal(current.body.data.content.title,fixture.title);
        assert.match(first.contentHash,/^[a-f0-9]{64}$/); assert.equal(first.versionNumber,'1');
        assert.ok(!JSON.stringify(current.body).includes(fixture.reviewBasis));
        assert.ok(!(await db.query('SELECT review_basis_ciphertext FROM privacy_notice_versions WHERE id=$1',[first.id])).rows[0].review_basis_ciphertext.includes(fixture.reviewBasis));
        assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='publish_privacy_notice' AND entity_id=$1",[first.id])).rows[0].n,1);
    });
    let receipt;
    await t.test('acknowledgement is explicit, owned, idempotent and independent of medical consent', async () => {
        const before = (await call('patient','GET','/notices/acknowledgements')).data;
        assert.equal(before.acknowledgedCurrent,false); assert.deepEqual(before.receipts,[]);
        await call('patient','POST','/notices/acknowledgements',{ versionId:first.id },400);
        await call('patient','POST','/notices/acknowledgements',{ versionId:first.id,acknowledged:true,patientId:people.otherPatient.id },400);
        await call('patient','POST','/notices/acknowledgements',{ versionId:first.id,acknowledged:true,acknowledgedAt:'2000-01-01' },400);
        receipt = (await call('patient','POST','/notices/acknowledgements',{versionId:first.id,acknowledged:true})).data;
        const duplicate = (await call('patient','POST','/notices/acknowledgements',{versionId:first.id,acknowledged:true})).data;
        assert.equal(duplicate.id,receipt.id); assert.equal(receipt.contentHash,first.contentHash);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM consents')).rows[0].n,consentCount);
        assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='acknowledge_privacy_notice' AND entity_id=$1",[receipt.id])).rows[0].n,1);
        assert.deepEqual((await call('otherPatient','GET','/notices/acknowledgements')).data.receipts,[]);
        await call('patient','GET',`/notices/acknowledgements?patientId=${people.otherPatient.id}`,undefined,400);
    });
    await t.test('owned exports include exact historical notice provenance and no other patient receipts', async () => {
        const password='Synthetic-export-password-123!'; const hash=await require('../src/services/encryption.service').hashPassword(password);
        await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,people.patient.id]);
        await call('otherPatient','POST','/notices/acknowledgements',{versionId:first.id,acknowledged:true});
        const exported=(await call('patient','POST','/privacy/export',{currentPassword:password})).data;
        assert.equal(exported.noticeAcknowledgements.length,1);
        assert.equal(exported.noticeAcknowledgements[0].id,receipt.id);
        assert.equal(exported.noticeAcknowledgements[0].notice.contentHash,first.contentHash);
        assert.equal(exported.noticeAcknowledgements[0].notice.content.sections.rights,fixture.sections.rights);
        assert.ok(!JSON.stringify(exported.noticeAcknowledgements).includes(fixture.reviewBasis));
    });
    await t.test('a new publication requires a fresh acknowledgement while old content and receipts remain intact', async () => {
        const second=(await call('officer','POST','/notices/versions',noticeFixture('A second synthetic notice'),201)).data;
        await call('patient','POST','/notices/acknowledgements',{versionId:first.id,acknowledged:true},409);
        const history=(await call('patient','GET','/notices/acknowledgements')).data;
        assert.equal(history.currentVersionId,second.id); assert.equal(history.acknowledgedCurrent,false);
        assert.equal(history.receipts[0].notice.content.title,fixture.title);
        assert.equal((await request(app).get(`/api/notices/versions/${first.id}`)).body.data.contentHash,first.contentHash);
        await call('patient','POST','/notices/acknowledgements',{versionId:second.id,acknowledged:true});
        assert.equal((await call('patient','GET','/notices/acknowledgements')).data.receipts.length,2);
        await assert.rejects(db.query("UPDATE privacy_notice_versions SET content='{}' WHERE id=$1",[first.id]),/immutable/i);
        await assert.rejects(db.query('DELETE FROM privacy_notice_acknowledgements WHERE id=$1',[receipt.id]),/immutable/i);
        await assert.rejects(db.query('UPDATE privacy_notice_current SET version_id=$1',[first.id]),/forward|newer/i);
    });
    await t.test('publication review history is private and paginated with explicit continuation', async () => {
        await call('patient','GET','/notices/versions',undefined,403);
        const history=(await call('officer','GET','/notices/versions')).data;
        assert.equal(history.versions.length,2); assert.equal(history.hasMore,false);
        assert.equal(history.versions[1].reviewBasis,fixture.reviewBasis);
        const older=(await call('officer','GET',`/notices/versions?before=${history.versions[0].versionNumber}`)).data;
        assert.equal(older.versions.length,1); assert.equal(older.versions[0].id,first.id);
        await call('officer','GET','/notices/versions?before=9223372036854775808',undefined,400);
    });
    await t.test('failed audit insertion leaves no publication, pointer movement or acknowledgement', async () => {
        const before=(await db.query('SELECT count(*)::int AS n FROM privacy_notice_versions')).rows[0].n;
        const pointer=(await db.query('SELECT version_id FROM privacy_notice_current')).rows[0].version_id;
        await db.query(`CREATE FUNCTION reject_fixture_notice_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('publish_privacy_notice','acknowledge_privacy_notice') THEN RAISE EXCEPTION 'Fixture notice audit outage'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER reject_fixture_notice_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_fixture_notice_audit()`);
        try {
            const publication=await call('officer','POST','/notices/versions',noticeFixture('Rejected publication'),null);
            assert.ok(publication.status>=500);
            assert.equal((await db.query('SELECT count(*)::int AS n FROM privacy_notice_versions')).rows[0].n,before);
            assert.equal((await db.query('SELECT version_id FROM privacy_notice_current')).rows[0].version_id,pointer);
            const acknowledgement=await call('otherPatient','POST','/notices/acknowledgements',{versionId:pointer,acknowledged:true},null);
            assert.ok(acknowledgement.status>=500);
            assert.equal((await db.query('SELECT count(*)::int AS n FROM privacy_notice_acknowledgements WHERE patient_id=$1 AND version_id=$2',[people.otherPatient.id,pointer])).rows[0].n,0);
        } finally { await db.query('DROP TRIGGER reject_fixture_notice_audit ON audit_logs; DROP FUNCTION reject_fixture_notice_audit()'); }
    });
    await t.test('simultaneous publications advance monotonically and simultaneous acknowledgements have one receipt', async () => {
        const versions=await Promise.all(['Concurrent version A','Concurrent version B'].map(title=>call('officer','POST','/notices/versions',noticeFixture(title),201)));
        const latest=versions.map(value=>value.data).sort((a,b)=>Number(b.versionNumber)-Number(a.versionNumber))[0];
        assert.equal((await request(app).get('/api/notices/current')).body.data.id,latest.id);
        const receipts=await Promise.all([1,2].map(()=>call('patient','POST','/notices/acknowledgements',{versionId:latest.id,acknowledged:true})));
        assert.equal(receipts[0].data.id,receipts[1].data.id);
        assert.equal((await db.query('SELECT count(*)::int AS n FROM privacy_notice_acknowledgements WHERE patient_id=$1 AND version_id=$2',[people.patient.id,latest.id])).rows[0].n,1);
    });
}));
