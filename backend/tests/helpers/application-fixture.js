const assert = require('node:assert/strict');
const { Client } = require('pg');

async function withApplication(name, callback) {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST));
    assert.equal(String(process.env.DB_PORT), '55432');
    const connection = { host: process.env.DB_HOST, port: 55432, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const admin = new Client({ ...connection, database: process.env.DB_NAME });
    await admin.connect();
    const database = `healthcare_${name}_${process.pid}`;
    assert.match(database, /^healthcare_[a-z_]+_\d+$/);
    await admin.query(`CREATE DATABASE ${database}`);
    process.env.DB_NAME = database;
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
    process.env.UPLOAD_PATH = '/scratch/fixture-uploads';
    let db; let server;
    try {
        const migrator = new Client({ ...connection, database });
        await migrator.connect();
        try { await require('../../src/database/migrate').migrate(migrator, { log() {} }); }
        finally { await migrator.end(); }
        db = require('../../src/config/db');
        const { generateAccessToken } = require('../../src/config/jwt');
        const { hashToken } = require('../../src/services/encryption.service');
        const people = {};
        for (const [key, role] of Object.entries({ patient: 'patient', otherPatient: 'patient', doctor: 'doctor', otherDoctor: 'doctor', nurse: 'nurse', admin: 'hospital_admin', otherAdmin: 'hospital_admin', officer: 'compliance_officer', researcher: 'researcher' })) {
            const user = (await db.query("INSERT INTO users(email,first_name,last_name,role_id,status,is_verified) VALUES($1,$2,'Fixture',(SELECT id FROM roles WHERE name=$3),'active',true) RETURNING id", [`${key}@example.invalid`, key, role])).rows[0];
            const token = generateAccessToken({ userId: user.id, roleName: role });
            await db.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')", [user.id, hashToken(token)]);
            people[key] = { id: user.id, token, role };
        }
        for (const key of ['patient', 'otherPatient']) await db.query('INSERT INTO patient_profiles(user_id,unique_health_id) VALUES($1,$2)', [people[key].id, key]);
        const organizations = [];
        for (const [i, key] of ['admin', 'otherAdmin'].entries()) organizations.push((await db.query("INSERT INTO organizations(name,type,license_number,hospital_code,admin_user_id,status,verified) VALUES($1,'hospital',$2,$3,$4,'active',true) RETURNING id", [`Fixture ${i}`, `FIXTURE-${i}`, `F0000${i}`, people[key].id])).rows[0].id);
        for (const [key, i] of [['doctor', 0], ['nurse', 0], ['otherDoctor', 1]]) await db.query("INSERT INTO staff_org_mapping(user_id,organization_id,role_id,status) VALUES($1,$2,(SELECT id FROM roles WHERE name=$3),'active')", [people[key].id, organizations[i], people[key].role]);
        const visit = (await db.query("INSERT INTO visits(patient_id,organization_id,visit_code,status,assigned_doctor_id,assigned_nurse_id) VALUES($1,$2,'FIXTURE-VISIT','in_progress',$3,$4) RETURNING id", [people.patient.id, organizations[0], people.doctor.id, people.nurse.id])).rows[0].id;
        for (const key of ['doctor', 'nurse']) await db.query("INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level,status,start_time) VALUES($1,$2,'all','treatment','write','active',NOW()-INTERVAL '1 minute')", [people.patient.id, people[key].id]);
        server = await new Promise(resolve => { const running = require('../../src/app').listen(0, '127.0.0.1', () => resolve(running)); });
        const call = async (actor, method, path, body, expected = 200) => {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { Authorization: `Bearer ${people[actor].token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
            const data = await response.json();
            if (expected === null) return { status: response.status, payload: data };
            assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
            return data;
        };
        await callback({ db, people, organizations, visit, call });
    } finally {
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        if (db) await db.pool.end();
        await admin.query(`DROP DATABASE ${database} WITH (FORCE)`);
        await admin.end();
    }
}
module.exports = { withApplication };
