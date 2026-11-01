const {test}=require('node:test');
const assert=require('node:assert/strict');
const {withApplication}=require('./helpers/application-fixture');
test('security events create confidential, atomic responder notifications',{skip:process.env.RUN_DB_TESTS!=='true'},async t=>withApplication('security_alerts',async({db,people,call})=>{
    const {recordViolation}=require('../src/services/violation.service');
    const event={userId:people.doctor.id,violationType:'consent_violation',severity:'high',description:'Synthetic restricted medical narrative'};
    await t.test('high events notify only active security responders with generic text',async()=>{
        const result=await recordViolation(event);assert.equal(result.success,true);
        const rows=(await db.query('SELECT * FROM notifications WHERE related_entity_id=$1',[result.violationId])).rows;
        assert.deepEqual(rows.map(row=>row.user_id),[people.officer.id]);
        assert.equal(rows[0].priority,'high');assert.equal(rows[0].type,'security_alert');
        assert.ok(!JSON.stringify(rows).includes(event.description));
        const inbox=(await call('officer','GET','/workflow/notifications')).data;
        assert.ok(inbox.some(row=>row.related_entity_id===result.violationId));
        const patientInbox=(await call('patient','GET','/workflow/notifications')).data;
        assert.ok(!patientInbox.some(row=>row.related_entity_id===result.violationId));
        await db.query("UPDATE security_events SET severity='critical' WHERE id=$1",[result.violationId]);
        assert.equal((await db.query('SELECT COUNT(*)::int count FROM notifications WHERE related_entity_id=$1',[result.violationId])).rows[0].count,1);
    });
    await t.test('low events remain recorded without paging responders',async()=>{
        const result=await recordViolation({...event,severity:'low'});assert.equal(result.success,true);
        assert.equal((await db.query('SELECT COUNT(*)::int count FROM notifications WHERE related_entity_id=$1',[result.violationId])).rows[0].count,0);
    });
    await t.test('delivery persistence failure rolls back event and audit instead of claiming success',async()=>{
        await db.query("CREATE FUNCTION fail_fixture_alert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='security_alert' THEN RAISE EXCEPTION 'fixture alert failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_fixture_alert BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION fail_fixture_alert()");
        const before=(await db.query('SELECT COUNT(*)::int count FROM security_events')).rows[0].count;
        const result=await recordViolation({...event,severity:'critical'});assert.equal(result.success,false);
        assert.equal((await db.query('SELECT COUNT(*)::int count FROM security_events')).rows[0].count,before);
        await db.query('DROP TRIGGER fail_fixture_alert ON notifications; DROP FUNCTION fail_fixture_alert()');
    });
}));
