const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const crypto = require('node:crypto');

const enabled = process.env.RUN_DB_TESTS === 'true';
test('clinical workflows enforce patient, role, care and tenant boundaries', { skip: !enabled, timeout: 90000 }, async t => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST));
    assert.notEqual(String(process.env.DB_PORT), '5432');
    const databaseName = `healthcare_access_test_${process.pid}`;
    const admin = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${databaseName}`);
    process.env.DB_NAME = databaseName;
    process.env.JWT_SECRET = 'test-only-access-secret-with-at-least-sixty-four-characters-for-validation';
    process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-with-at-least-sixty-four-characters-for-validation';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.AI_ENABLED = 'false';
    process.env.UPLOAD_PATH = require('node:path').resolve(__dirname, '../../.local', `access-files-${process.pid}`);
    process.env.ENABLE_HASH_CHAIN = 'true';
    process.env.CLAMAV_HOST = '';
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
    let server; let db;
    try {
        const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: databaseName,
            user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false });
        await client.connect();
        try { await require('../src/database/migrate').migrate(client, { log: () => {} }); } finally { await client.end(); }
        db = require('../src/config/db');
        const { generateAccessToken } = require('../src/config/jwt');
        const { hashToken } = require('../src/services/encryption.service');
        const people = {};
        for (const [key, role] of Object.entries({ patient: 'patient', otherPatient: 'patient', doctor: 'doctor', otherDoctor: 'doctor', nurse: 'nurse', lab: 'lab_technician', radiologist: 'radiologist', pharmacist: 'pharmacist', admin: 'hospital_admin', otherAdmin: 'hospital_admin', system: 'system_admin', insurer: 'insurance_provider' })) {
            const result = await db.query("INSERT INTO users(email,first_name,last_name,role_id,status,is_verified) VALUES($1,$2,'Fixture',(SELECT id FROM roles WHERE name=$3),'active',true) RETURNING id", [`${key}@example.invalid`, key, role]);
            const id = result.rows[0].id;
            const token = generateAccessToken({ userId: id, roleName: role });
            await db.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [id, hashToken(token)]);
            people[key] = { id, role, token };
        }
        for (const key of ['patient', 'otherPatient']) await db.query('INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,$2)', [people[key].id, `ACCESS-${key}`]);
        const orgs = [];
        for (const [index, key] of ['admin', 'otherAdmin'].entries()) {
            orgs.push((await db.query("INSERT INTO organizations(name,type,license_number,hospital_code,admin_user_id,status,verified) VALUES($1,'hospital',$2,$3,$4,'active',true) RETURNING id", [`Fixture hospital ${index}`, `ACCESS-${index}`, `ACCES${index}`, people[key].id])).rows[0].id);
        }
        for (const key of ['doctor', 'nurse', 'lab', 'radiologist', 'pharmacist', 'admin']) await db.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,(SELECT id FROM roles WHERE name=$3),'active')", [people[key].id, orgs[0], people[key].role]);
        for (const key of ['otherDoctor', 'otherAdmin']) await db.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,(SELECT id FROM roles WHERE name=$3),'active')", [people[key].id, orgs[1], people[key].role]);
        const visits = [];
        for (const [index, key] of ['patient', 'otherPatient'].entries()) visits.push((await db.query("INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id,assigned_nurse_id) VALUES($1,$2,$3,'in_progress',$4,$5) RETURNING id", [people[key].id, orgs[index], `ACCESS-VISIT-${index}`, people[index ? 'otherDoctor' : 'doctor'].id, index ? null : people.nurse.id])).rows[0].id);
        for (const key of ['doctor', 'nurse', 'lab', 'radiologist', 'pharmacist', 'otherDoctor', 'insurer']) await db.query("INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level,start_time,end_time,status) VALUES($1,$2,'all','synthetic integration fixture','write',NOW()-INTERVAL '1 minute',NOW()+INTERVAL '1 hour','active')", [people.patient.id, people[key].id]);
        const foreignRecord = (await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,created_by,immutable_flag) VALUES($1,$2,'consultation','Foreign synthetic record',$3,true) RETURNING id", [people.otherPatient.id, visits[1], people.otherDoctor.id])).rows[0].id;
        const app = require('../src/app');
        server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        async function request(key, method, path, body, expected = 200) {
            const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${people[key].token}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
            const payload = await response.json();
            assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(payload)}`);
            return payload;
        }
        let record; let labOrder; let imagingOrder; let prescription;
        await t.test('assigned clinician creates records; patient only reads own records', async () => {
            const result = await request('doctor', 'POST', '/emr/medical-records', { patientId: people.patient.id, visitId: visits[0], type: 'consultation', title: 'Synthetic integration record', description: 'Synthetic fixture' }, 201);
            record = result.data.id;
            await request('patient', 'GET', `/emr/medical-records/${record}`);
            await request('otherPatient', 'GET', `/emr/medical-records/${record}`, undefined, 403);
            await request('system', 'GET', `/emr/medical-records/${record}`, undefined, 403);
            await request('otherDoctor', 'GET', `/emr/medical-records/${record}`, undefined, 403);
            await request('patient', 'POST', '/emr/diagnoses', { recordId: record, icdCode: 'J00', description: 'Fixture' }, 403);
            await request('doctor', 'POST', '/emr/medical-records', { patientId: people.otherPatient.id, visitId: visits[0], type: 'consultation' }, 400);
        });
        await t.test('consent revocation and future grants block access immediately', async () => {
            await db.query("UPDATE consents SET status='revoked' WHERE recipient_user_id=$1", [people.doctor.id]);
            await request('doctor', 'GET', `/emr/medical-records/${record}`, undefined, 403);
            await db.query("UPDATE consents SET status='active', start_time=NOW()+INTERVAL '1 hour' WHERE recipient_user_id=$1", [people.doctor.id]);
            await request('doctor', 'GET', `/emr/medical-records/${record}`, undefined, 403);
            await db.query("UPDATE consents SET start_time=NOW()-INTERVAL '1 minute' WHERE recipient_user_id=$1", [people.doctor.id]);
        });
        await t.test('clinical orders appear in authorized laboratory and radiology queues', async () => {
            labOrder = (await request('doctor', 'POST', '/workflow/lab-orders', { visitId: visits[0], testName: 'Fixture CBC', testCategory: 'hematology' }, 201)).data.id;
            imagingOrder = (await request('doctor', 'POST', '/workflow/imaging-orders', { visitId: visits[0], imagingType: 'X-Ray', bodyPart: 'chest' }, 201)).data.id;
            await db.query("INSERT INTO lab_orders(visit_id,ordered_by,test_name,test_category) VALUES($1,$2,'Foreign CBC','hematology')", [visits[1], people.otherDoctor.id]);
            const lab = await request('lab', 'GET', '/lab/orders'); assert.deepEqual(lab.data.map(row => row.id), [labOrder]);
            await request('lab', 'GET', `/lab/orders/${labOrder}`);
            await request('patient', 'GET', '/lab/orders', undefined, 403);
            await request('patient', 'GET', '/radiology/orders', undefined, 403);
            const radiology = await request('radiologist', 'GET', '/radiology/orders'); assert.ok(radiology.data.some(row => row.id === imagingOrder));
            await request('lab', 'GET', '/lab/stats'); await request('radiologist', 'GET', '/radiology/stats');
            await request('doctor', 'GET', `/emr/visits/${visits[0]}/lab-orders`);
            await request('doctor', 'GET', `/emr/visits/${visits[0]}/imaging-orders`);
            await request('patient', 'POST', '/workflow/lab-orders', { visitId: visits[1], testName: 'Unauthorized' }, 403);
        });
        await t.test('nursing and prescription workflows are restricted to the patient care context', async () => {
            await request('nurse', 'GET', `/nurse/patients/${people.patient.id}/records`);
            await request('nurse', 'GET', `/nurse/patients/${people.otherPatient.id}/records`, undefined, 403);
            await request('nurse', 'POST', `/nurse/patients/${people.otherPatient.id}/records`, { type: 'note', title: 'Unauthorized' }, 403);
            const result = await request('doctor', 'POST', '/emr/prescriptions', { recordId: record, medication: 'Synthetic test medication', dosage: '1mg', frequency: 'once daily', route: 'oral', quantity: 1 }, 201);
            prescription = result.data.id;
            const queue = await request('pharmacist', 'GET', '/pharmacist/prescriptions'); assert.ok(queue.data.some(row => row.id === prescription));
            await request('pharmacist', 'GET', '/pharmacist/stats'); await request('pharmacist', 'GET', '/pharmacist/inventory');
            await request('pharmacist', 'PUT', `/pharmacist/prescriptions/${prescription}/dispense`, {});
            assert.equal((await db.query('SELECT status FROM prescriptions WHERE id=$1', [prescription])).rows[0].status, 'completed');
        });
        await t.test('diagnosis addenda preserve the previous version', async () => {
            const original = (await request('doctor','POST','/emr/diagnoses',{recordId:record,icdCode:'J00',description:'Synthetic initial diagnosis'},201)).data;
            const revised = (await request('doctor','POST',`/emr/diagnoses/${original.id}/addendum`,{description:'Synthetic amended diagnosis'},201)).data;
            assert.equal(revised.version,2);
            assert.equal((await db.query('SELECT description FROM diagnoses WHERE id=$1',[original.id])).rows[0].description,'Synthetic initial diagnosis');
        });
        await t.test('nursing records administration separately from pharmacy dispensing', async () => {
            const order = (await db.query('SELECT * FROM medication_orders WHERE prescription_id=$1',[prescription])).rows[0];
            assert.ok(order, 'Prescribing must create a linked medication order');
            assert.equal(order.status,'dispensed');
            const queue = await request('nurse','GET','/nurse/medications'); assert.ok(queue.data.some(row=>row.id===order.id));
            await request('nurse','PUT',`/nurse/medications/${order.id}/status`,{status:'administered'});
            const saved = (await db.query('SELECT administered_by,status FROM medication_orders WHERE id=$1',[order.id])).rows[0];
            assert.equal(saved.administered_by,people.nurse.id); assert.equal(saved.status,'administered');
            assert.equal((await db.query('SELECT dispensed_by FROM prescriptions WHERE id=$1',[prescription])).rows[0].dispensed_by,people.pharmacist.id);
        });
        await t.test('visit management, platform onboarding and staff provisioning respect tenant/role scope', async () => {
            await request('admin', 'PATCH', `/visits/${visits[1]}/scheduled-time`, { scheduledTime: new Date().toISOString() }, 403);
            await request('otherAdmin', 'POST', `/visits/${visits[0]}/close`, { status: 'completed' }, 403);
            await request('admin', 'GET', '/admin/organizations/pending', undefined, 403);
            await request('system', 'GET', '/admin/organizations/pending');
            await request('admin', 'POST', '/staff/invite', { email: 'privileged@example.invalid', role: 'system_admin', organizationId: orgs[0] }, 403);
            await request('admin', 'POST', '/staff/invite', { email: 'foreign@example.invalid', role: 'doctor', organizationId: orgs[1] }, 403);
            await request('admin', 'GET', '/staff/accounts/stats'); await request('admin', 'GET', '/staff/accounts/suspended'); await request('admin', 'GET', '/staff/actions/recent');
            await request('admin', 'GET', `/visits/${visits[0]}/staff`);
        });
        await t.test('notifications only mark the caller own items read', async () => {
            const notification = (await db.query("INSERT INTO notifications(user_id,type,title,message) VALUES($1,'visit','Fixture','Fixture') RETURNING id", [people.patient.id])).rows[0].id;
            await request('otherPatient', 'PATCH', `/workflow/notifications/${notification}/read`, {});
            assert.equal((await db.query('SELECT read FROM notifications WHERE id=$1', [notification])).rows[0].read, false);
            await request('patient', 'PATCH', `/workflow/notifications/${notification}/read`, {});
            assert.equal((await db.query('SELECT read FROM notifications WHERE id=$1', [notification])).rows[0].read, true);
            await request('patient', 'POST', '/workflow/notifications', { userId: people.otherPatient.id, type: 'visit', title: 'Spoof', message: 'Spoof' }, 403);
        });
        await t.test('temporary grants are owned read-only and cannot be replayed', async () => {
            await request('patient', 'POST', '/workflow/tokens/generate', { userId: people.otherPatient.id, scope: { resourceType: 'medical_record', resourceId: foreignRecord, permissions: ['read'] } }, 403);
            const grant = (await request('patient', 'POST', '/workflow/tokens/generate', { scope: { resourceType: 'medical_record', resourceId: record, permissions: ['read'] }, expiresInMinutes: 5 }, 201)).data.token;
            await request('doctor', 'POST', '/workflow/tokens/validate', { token: grant });
            await request('doctor', 'POST', '/workflow/tokens/validate', { token: grant }, 401);
        });
        await t.test('granular laboratory consent never unlocks unrelated records', async () => {
            await db.query("UPDATE consents SET data_category='lab_results' WHERE recipient_user_id=$1",[people.lab.id]);
            const labRecord = (await db.query("INSERT INTO medical_records(patient_id,visit_id,type,title,created_by,immutable_flag) VALUES($1,$2,'lab_result','Granular lab fixture',$3,true) RETURNING id",[people.patient.id,visits[0],people.lab.id])).rows[0].id;
            await request('lab','GET','/lab/orders');
            await request('lab','GET',`/emr/medical-records/${labRecord}`);
            await request('lab','GET',`/emr/medical-records/${record}`,undefined,403);
            await request('lab','GET',`/emr/medical-records/${labRecord}?includeRelated=true`,undefined,403);
        });
        await t.test('only the patient can approve visit grants; closing preserves manual consent', async () => {
            const pending = (await db.query("INSERT INTO visits(patient_id,organization_id,visit_code,status) VALUES($1,$2,'ACCESS-PENDING','pending') RETURNING id",[people.patient.id,orgs[0]])).rows[0].id;
            const model = require('../src/models/visit.model');
            const approved = await model.approveVisit(pending,people.doctor.id,people.nurse.id);
            assert.equal((await db.query('SELECT count(*) FROM consents WHERE visit_id=$1',[pending])).rows[0].count,'0');
            await request('otherPatient','POST',`/visits/${pending}/verify-otp`,{otp:approved.otp_code,accessLevel:'write'},403);
            assert.equal((await db.query('SELECT otp_verified FROM visits WHERE id=$1',[pending])).rows[0].otp_verified,false);
            await request('patient','POST',`/visits/${pending}/verify-otp`,{otp:approved.otp_code,accessLevel:'read'});
            const grants = (await db.query("SELECT access_level,source FROM consents WHERE visit_id=$1",[pending])).rows;
            assert.equal(grants.length,2); assert.ok(grants.every(row=>row.access_level==='read'&&row.source==='visit'));
            await request('admin','PATCH',`/visits/${pending}/assign`,{otpVerified:true,accessLevel:'write'},403);
            await model.closeVisit(pending,people.admin.id,'completed');
            assert.equal((await db.query("SELECT count(*) FROM consents WHERE visit_id=$1 AND status='active'",[pending])).rows[0].count,'0');
            assert.equal((await db.query("SELECT status FROM consents WHERE patient_id=$1 AND recipient_user_id=$2 AND source='manual'",[people.patient.id,people.doctor.id])).rows[0].status,'active');
        });
        await t.test('nurse writes require assignment to the exact visit, including same-patient visits', async () => {
            const foreign = (await db.query("INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id) VALUES($1,$2,'ACCESS-CROSS-VISIT','in_progress',$3) RETURNING id",[people.patient.id,orgs[1],people.otherDoctor.id])).rows[0].id;
            await request('nurse','POST',`/nurse/patients/${people.patient.id}/records`,{visitId:foreign,type:'note',title:'Forbidden cross-organization write'},403);
            await request('nurse','POST',`/nurse/patients/${people.otherPatient.id}/records`,{visitId:visits[0],type:'note',title:'Conflicting patient'},400);
        });
        await t.test('revoked assignment and inactive organization membership override manual consent', async () => {
            await db.query("INSERT INTO visit_staff_assignments(visit_id,staff_user_id,role,access_level,revoked_at) VALUES($1,$2,'doctor','revoked',NOW()) ON CONFLICT(visit_id,staff_user_id) DO UPDATE SET access_level='revoked',revoked_at=NOW()",[visits[0],people.doctor.id]);
            await request('doctor','GET',`/emr/medical-records/${record}`,undefined,403);
            await db.query("UPDATE visit_staff_assignments SET revoked_at=NULL,access_level='full' WHERE visit_id=$1 AND staff_user_id=$2",[visits[0],people.doctor.id]);
            await db.query("UPDATE staff_org_mapping SET status='inactive' WHERE user_id=$1",[people.doctor.id]);
            await request('doctor','GET',`/emr/medical-records/${record}`,undefined,403);
            assert.deepEqual((await request('doctor','GET','/visits/assigned')).data,[]);
            await db.query("UPDATE staff_org_mapping SET status='active' WHERE user_id=$1",[people.doctor.id]);
        });
        await t.test('concurrent invitation acceptance changes the password exactly once', async () => {
            const email = 'concurrent-invitation@example.invalid'; const token=crypto.randomBytes(32).toString('hex');
            const user=(await db.query("INSERT INTO users(email,role_id,status) VALUES($1,(SELECT id FROM roles WHERE name='nurse'),'pending') RETURNING id",[email])).rows[0].id;
            await db.query("INSERT INTO staff_invitations(email,role,organization_id,token,invited_by,expires_at) VALUES($1,'nurse',$2,$3,$4,NOW()+INTERVAL '1 hour')",[email,orgs[0],token,people.admin.id]);
            const service=require('../src/services/staff.invitation.service');service.sendWelcomeEmail=async()=>{};
            const passwords=['OnlyOne-Password-123!','OnlyTwo-Password-123!'];
            const results=await Promise.allSettled(passwords.map(password=>service.acceptInvitation(token,{firstName:'Fixture',lastName:'Concurrent',password})));
            assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
            assert.equal(results.filter(row=>row.status==='rejected').length,1);
            const winner=results.findIndex(row=>row.status==='fulfilled');
            const saved=(await db.query('SELECT password_hash,status FROM users WHERE id=$1',[user])).rows[0];
            assert.equal(saved.status,'active');assert.equal(await require('bcrypt').compare(passwords[winner],saved.password_hash),true);
            assert.equal((await db.query('SELECT status FROM staff_invitations WHERE token=$1',[token])).rows[0].status,'accepted');
        });
        await t.test('bed allocation uses form fields and organization scope and prevents double booking', async () => {
            const bed=(await request('admin','POST','/workflow/bed-allocations',{visitId:visits[0],ward:'Fixture',roomNumber:'1',bedNumber:'A',bedType:'general'},201)).data;
            assert.equal(bed.room,'1');assert.equal(bed.organization_id,orgs[0]);
            await request('admin','PATCH',`/workflow/bed-allocations/${bed.id}/release`,{});
            const available=await request('admin','GET','/workflow/bed-allocations/available');assert.ok(available.data.some(row=>row.room==='1'&&row.bed==='A'));
            await request('admin','POST','/workflow/bed-allocations',{visitId:visits[0],ward:'Fixture',roomNumber:'1',bedNumber:'A'},201);
            const occupied=await request('admin','GET','/workflow/bed-allocations/available');assert.ok(!occupied.data.some(row=>row.room==='1'&&row.bed==='A'));
            await request('admin','POST','/workflow/bed-allocations',{visitId:visits[0],ward:'Fixture',roomNumber:'1',bedNumber:'B'},409);
            await request('otherAdmin','POST','/workflow/bed-allocations',{visitId:visits[1],ward:'Fixture',roomNumber:'1',bedNumber:'A'},201);
        });
        await t.test('laboratory and radiology uploads encrypt files and publish owned EMR references', async () => {
            const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
            async function upload(key,path,fields) {
                const form=new FormData();for (const [name,value] of Object.entries(fields)) form.append(name,value);
                form.append('file',new Blob([bytes],{type:'application/pdf'}),'fixture.pdf');
                const response=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${people[key].token}`},body:form});
                const payload=await response.json();assert.equal(response.status,201,JSON.stringify(payload));return payload.data;
            }
            const result=await upload('lab','/lab/upload',{order_id:labOrder,patient_id:people.patient.id,visit_id:visits[0],notes:'Synthetic result'});
            assert.match(result.file_url,/^\/api\/files\//);
            const downloaded=await fetch(base.replace(/\/api$/,'')+result.file_url,{headers:{Authorization:`Bearer ${people.patient.token}`}});
            assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
            const denied=await fetch(base.replace(/\/api$/,'')+result.file_url,{headers:{Authorization:`Bearer ${people.otherPatient.token}`}});assert.equal(denied.status,403);
            const store=require('../src/services/file.upload.service');
            const encrypted=await require('node:fs/promises').readFile(require('node:path').join(store.getStoragePath(people.patient.id,'lab_results'),result.file_name));
            assert.ok(!encrypted.equals(bytes));assert.ok(!encrypted.includes(Buffer.from('%PDF')));
            const report=await upload('radiologist','/radiology/upload',{orderId:imagingOrder,patientId:people.patient.id,reportTitle:'Synthetic imaging report',findings:'Synthetic finding',impression:'Synthetic impression'});
            assert.match(report.file_path,/^\/api\/files\//);
            const records=await request('patient','GET',`/emr/patients/${people.patient.id}/medical-records?type=imaging`);
            const record=records.data.records.find(row=>row.title==='Synthetic imaging report');assert.ok(record);
            const hydrated=await request('patient','GET',`/emr/medical-records/${record.id}?includeRelated=true`);
            assert.equal(hydrated.data.imagingReports[0].file_url,report.file_path);
            await request('radiologist','GET','/radiology/audit-logs');
        });
        await t.test('workflow transitions use the canonical status and append history', async () => {
            await request('doctor', 'PATCH', `/workflow/visits/${visits[0]}/state`, { newState: 'completed' });
            assert.equal((await db.query('SELECT status FROM visits WHERE id=$1', [visits[0]])).rows[0].status, 'completed');
            const history = await request('patient', 'GET', `/workflow/visits/${visits[0]}/history`); assert.equal(history.data.at(-1).to_state, 'completed');
            await request('doctor', 'POST', '/workflow/lab-orders', { visitId: visits[0], testName: 'After completion' }, 403);
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.pool.end();
        const path=require('node:path');const upload=path.resolve(process.env.UPLOAD_PATH);
        assert.ok(upload.startsWith(path.resolve(__dirname,'../../.local')+path.sep));
        assert.match(path.basename(upload),/^access-files-\d+$/);
        await require('node:fs/promises').rm(upload,{recursive:true,force:true});
        await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]);
        assert.match(databaseName, /^healthcare_access_test_\d+$/);
        await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
        await admin.end();
    }
});
