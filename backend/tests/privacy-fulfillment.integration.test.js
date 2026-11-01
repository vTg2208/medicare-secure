const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withApplication } = require('./helpers/application-fixture');

test('privacy review decisions produce enforceable processing controls and visible corrections', { skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000 }, async t => withApplication('fulfillment', async ({ db, people, visit, call }) => {
    const record = (await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,description,created_by,immutable_flag) VALUES($1,$2,'consultation','Original retained note','Original clinical narrative',$3,true) RETURNING id",[people.patient.id,visit,people.doctor.id])).rows[0].id;
    const decision = { status: 'fulfilled', resolution: 'Reviewed and applied the requested processing change.', retentionBasis: 'Synthetic reviewed legal basis for this test.' };
    const open = async type => {
        const request = (await call('patient','POST','/privacy/requests',{type,details:'Please review this synthetic patient information request.'},201)).data;
        await call('officer','PUT',`/privacy/requests/${request.id}`,{status:'in_review'});
        return request.id;
    };
    await t.test('a restriction cannot be marked fulfilled without an actual action', async () => {
        const id = await open('restriction');
        await call('officer','PUT',`/privacy/requests/${id}`,decision,400);
        assert.equal((await db.query('SELECT status FROM privacy_rights_requests WHERE id=$1',[id])).rows[0].status,'in_review');
    });
    await t.test('research objection removes the patient from aggregates even with an active research consent', async () => {
        for (let i=0;i<5;i++) {
            const patient = i===0 ? people.patient.id : (await db.query("INSERT INTO users(email,role_id,status,is_verified) VALUES($1,(SELECT id FROM roles WHERE name='patient'),'active',true) RETURNING id",[`cohort-${i}@example.invalid`])).rows[0].id;
            if (i) await db.query('INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,$2)',[patient,`COHORT-${i}`]);
            await db.query("INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level,start_time,status) VALUES($1,$2,'all','clinical_research','read',NOW()-INTERVAL '1 minute','active')",[patient,people.researcher.id]);
        }
        assert.equal((await call('researcher','GET','/research/stats')).data.anonymizedPatients,5);
        const id = await open('objection');
        await call('officer','PUT',`/privacy/requests/${id}`,{...decision,action:{type:'restrict',purpose:'research'}});
        assert.equal((await call('researcher','GET','/research/stats')).data.suppressed,true);
        assert.equal((await db.query("SELECT COUNT(*)::int count FROM patient_processing_controls WHERE patient_id=$1 AND purpose='research' AND released_at IS NULL",[people.patient.id])).rows[0].count,1);
        await call('patient','PUT',`/privacy/requests/${id}`,decision,403);
    });
    await t.test('clinical restrictions stop ordinary access, preserve patient access and retain audited emergency exceptions', async () => {
        const id = await open('restriction');
        await call('officer','PUT',`/privacy/requests/${id}`,{...decision,action:{type:'restrict',purpose:'treatment'}});
        await call('doctor','GET',`/emr/medical-records/${record}`,undefined,403);
        await call('patient','GET',`/emr/medical-records/${record}`);
        await call('doctor','POST','/emergency/activate',{patientId:people.patient.id,justification:'Synthetic emergency requires immediate clinical review.'},201);
        await call('doctor','GET',`/emr/medical-records/${record}`);
        const controls = await call('patient','GET','/privacy/controls');
        assert.equal(controls.data.length,2);
        await call('otherPatient','POST','/privacy/controls/release',{controlId:controls.data[0].id},404);
        const clinical = controls.data.find(control=>control.purpose==='treatment');
        await call('patient','POST','/privacy/controls/release',{controlId:clinical.id});
        assert.ok((await db.query('SELECT released_at FROM patient_processing_controls WHERE id=$1',[clinical.id])).rows[0].released_at);
    });
    await t.test('rectification appends a correction to the correct patient record and exposes it in clinical detail', async () => {
        const id = await open('rectification');
        await call('officer','PUT',`/privacy/requests/${id}`,{...decision,action:{type:'correction',recordId:record,text:'Corrected patient-reported history after documented review.'}});
        const details = (await call('patient','GET',`/emr/medical-records/${record}?includeRelated=true`)).data;
        assert.equal(details.description,'Original clinical narrative');
        assert.equal(details.corrections[0].text,'Corrected patient-reported history after documented review.');
        const otherRecord = (await db.query("INSERT INTO medical_records(patient_id,type,title,created_by,immutable_flag) VALUES($1,'note','Other patient',$2,true) RETURNING id",[people.otherPatient.id,people.doctor.id])).rows[0].id;
        const invalid = await open('rectification');
        await call('officer','PUT',`/privacy/requests/${invalid}`,{...decision,action:{type:'correction',recordId:otherRecord,text:'Must never attach to another patient record.'}},400);
    });
    await t.test('decision audit failures roll back both fulfillment and its processing control', async () => {
        const id=await open('restriction');
        await db.query("CREATE FUNCTION reject_fixture_privacy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='resolve_privacy_request' THEN RAISE EXCEPTION 'Fixture audit outage'; END IF; RETURN NEW; END $$");
        await db.query('CREATE TRIGGER reject_fixture_privacy_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_fixture_privacy_audit()');
        try {
            await call('officer','PUT',`/privacy/requests/${id}`,{...decision,action:{type:'restrict',purpose:'insurance'}},500);
            assert.equal((await db.query('SELECT status FROM privacy_rights_requests WHERE id=$1',[id])).rows[0].status,'in_review');
            assert.equal((await db.query('SELECT COUNT(*)::int count FROM patient_processing_controls WHERE request_id=$1',[id])).rows[0].count,0);
        } finally { await db.query('DROP TRIGGER reject_fixture_privacy_audit ON audit_logs'); }
    });
    await t.test('reviewed demographic correction changes the owned profile and rejects credential fields', async () => {
        const id=await open('rectification');
        await call('officer','PUT',`/privacy/requests/${id}`,{...decision,action:{type:'profile_correction',changes:{date_of_birth:'1990-02-28',first_name:'Corrected'}}});
        const profile=(await db.query('SELECT u.first_name,p.date_of_birth::text birthday FROM users u JOIN patient_profiles p ON p.user_id=u.id WHERE u.id=$1',[people.patient.id])).rows[0];
        assert.equal(profile.first_name,'Corrected'); assert.equal(profile.birthday,'1990-02-28');
        for (const changes of [{password_hash:'intrusion'},{date_of_birth:'1990-02-30'}]) {
            const invalid=await open('rectification');
            await call('officer','PUT',`/privacy/requests/${invalid}`,{...decision,action:{type:'profile_correction',changes}},400);
        }
    });
    await t.test('AI and messaging restrictions are applied to their actual API paths', async () => {
        const thread=(await call('patient','POST','/messages/threads',{recipientId:people.doctor.id},201)).data;
        const ai=await open('objection');
        await call('officer','PUT',`/privacy/requests/${ai}`,{...decision,action:{type:'restrict',purpose:'ai'}});
        await call('patient','POST','/chatbot/start',{},403);
        const messaging=await open('restriction');
        await call('officer','PUT',`/privacy/requests/${messaging}`,{...decision,action:{type:'restrict',purpose:'messaging'}});
        await call('doctor','GET',`/messages/threads/${thread.id}/messages`,undefined,403);
        await call('patient','POST',`/messages/threads/${thread.id}/messages`,{body:'Blocked by processing decision'},403);
    });
}));
