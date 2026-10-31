const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { readMigrations } = require('../src/database/migrate');
const { sqlLiteral, OUTPUT_DIRECTORY, LOCK_KEY } = require('./export-browser-schema');

const DEMO_ROLES = Object.freeze(['system_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist',
    'lab_technician', 'radiologist', 'pharmacist', 'insurance_provider', 'researcher', 'compliance_officer', 'patient']);
const EXTRA_PATIENT_EMAILS = Object.freeze(Array.from({ length: 4 }, (_, index) => `synthetic_patient_${index + 2}@demo.invalid`));

function requireDemoMode() {
    if (process.env.DEMO_MODE !== 'true') throw new Error('Synthetic seeding requires explicit DEMO_MODE=true');
}

function buildDemoSeedSql(passwordHashes) {
    requireDemoMode();
    for (const role of DEMO_ROLES) {
        if (!/^\$2[aby]\$(?:1[0-6])\$[./A-Za-z0-9]{53}$/.test(passwordHashes?.[role] || '')) {
            throw new Error(`A bcrypt password hash (cost 10-16) is required for ${role}`);
        }
    }
    const users = Object.fromEntries(DEMO_ROLES.map(role => [role, crypto.randomUUID()]));
    const organization = crypto.randomUUID();
    const visit = crypto.randomUUID();
    const literal = sqlLiteral;
    const migrations = readMigrations();
    const statements = [`BEGIN;
SELECT pg_advisory_xact_lock(${LOCK_KEY});
SET LOCAL search_path TO healthcare, public, extensions;
-- Generated only with DEMO_MODE=true. Synthetic data; never use for real care.
DO $demo_guard$
BEGIN
    IF to_regclass('healthcare.users') IS NULL OR to_regclass('healthcare._migrations') IS NULL THEN
        RAISE EXCEPTION 'Synthetic seeding requires the healthcare browser schema';
    END IF;
END
$demo_guard$;
LOCK TABLE healthcare.users IN EXCLUSIVE MODE;
DO $demo_guard$
BEGIN
    IF EXISTS (SELECT 1 FROM healthcare.users) THEN
        RAISE EXCEPTION 'Refusing synthetic seed: healthcare.users is not empty';
    END IF;
    IF (SELECT count(*) FROM healthcare._migrations) <> ${migrations.length}
        OR ${migrations.map(m => `NOT EXISTS (SELECT 1 FROM healthcare._migrations WHERE id=${literal(m.id)} AND file_hash=${literal(m.hash)})`).join('\n        OR ')} THEN
        RAISE EXCEPTION 'Synthetic seeding requires the exact current migration ledger';
    END IF;
END
$demo_guard$;`];
    for (const role of DEMO_ROLES) statements.push(`INSERT INTO users(id,email,password_hash,role_id,first_name,last_name,is_verified,status,verification_status)
SELECT ${literal(users[role])},${literal(`${role}@demo.invalid`)},${literal(passwordHashes[role])},id,'Synthetic',${literal(role)},true,'active','verified' FROM roles WHERE name=${literal(role)};`);
    statements.push(`INSERT INTO organizations(id,name,type,license_number,admin_user_id,status,verified,hospital_code)
VALUES(${literal(organization)},'Synthetic Demo Hospital','hospital','DEMO-ONLY-HOSPITAL',${literal(users.hospital_admin)},'active',true,'D00001');`);
    for (const role of ['hospital_admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'radiologist', 'pharmacist', 'compliance_officer']) statements.push(`INSERT INTO staff_org_mapping(user_id,organization_id,role_id,license_verified)
SELECT ${literal(users[role])},${literal(organization)},id,true FROM roles WHERE name=${literal(role)};`);
    statements.push(`INSERT INTO doctor_profiles(user_id,specialization,license_number)
VALUES(${literal(users.doctor)},'General Medicine','DEMO-ONLY-DOCTOR');
INSERT INTO nurse_profiles(user_id) VALUES(${literal(users.nurse)});
INSERT INTO patient_profiles(user_id,unique_health_id,date_of_birth,gender)
VALUES(${literal(users.patient)},'DEMO-SYNTHETIC-001','1990-01-01','other');
INSERT INTO visits(id,patient_id,organization_id,assigned_doctor_id,assigned_nurse_id,status,visit_code,reason)
VALUES(${literal(visit)},${literal(users.patient)},${literal(organization)},${literal(users.doctor)},${literal(users.nurse)},'in_progress','DEMO-001','Synthetic demonstration visit; no real patient information');`);
    // Five consenting patients let the research dashboard demonstrate its minimum
    // cohort behavior. Additional synthetic patients share the private patient login password.
    for (const [index, email] of EXTRA_PATIENT_EMAILS.entries()) {
        const patient = crypto.randomUUID();
        statements.push(`INSERT INTO users(id,email,password_hash,role_id,first_name,last_name,is_verified,status,verification_status)
SELECT ${literal(patient)},${literal(email)},${literal(passwordHashes.patient)},id,'Synthetic',${literal(`Patient ${index + 2}`)},true,'active','verified' FROM roles WHERE name='patient';
INSERT INTO patient_profiles(user_id,unique_health_id,date_of_birth,gender)
VALUES(${literal(patient)},${literal(`DEMO-SYNTHETIC-00${index + 2}`)},'1990-01-01','other');
INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level)
VALUES(${literal(patient)},${literal(users.researcher)},'all_medical_data','clinical_research','read');`);
    }
    for (const role of ['doctor', 'nurse']) statements.push(`INSERT INTO visit_staff_assignments(visit_id,staff_user_id,role)
VALUES(${literal(visit)},${literal(users[role])},${literal(role)});`);
    for (const role of ['doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist', 'insurance_provider', 'researcher']) statements.push(`INSERT INTO consents(patient_id,recipient_user_id,data_category,purpose,access_level)
VALUES(${literal(users.patient)},${literal(users[role])},'all_medical_data',${literal(role === 'researcher' ? 'clinical_research' : 'treatment')},${literal(role === 'researcher' ? 'read' : 'write')});`);
    statements.push(`INSERT INTO medical_records(patient_id,visit_id,type,title,description,created_by)
VALUES(${literal(users.patient)},${literal(visit)},'consultation','Synthetic demo record','Synthetic demonstration data only. No real patient information. Not medical advice.',${literal(users.doctor)});
COMMIT;`);
    return `${statements.join('\n')}\n`;
}

// Pass a connected pg Client so rollback uses the same connection after errors.
async function seedHostedDemo(client, passwordHashes) {
    const sql = buildDemoSeedSql(passwordHashes);
    try {
        await client.query(sql);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}

async function main(args = process.argv.slice(2)) {
    requireDemoMode();
    if (args.length) throw new Error('Usage: DEMO_MODE=true node scripts/hosted-demo-seed.js');
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    const sqlPath = path.join(OUTPUT_DIRECTORY, 'browser-demo-seed.sql');
    const credentialsPath = path.join(OUTPUT_DIRECTORY, 'browser-demo-credentials.txt');
    const created = [];
    const handles = [];
    try {
        // Reserve both paths without replacing existing seed material or credentials.
        for (const file of [sqlPath, credentialsPath]) {
            handles.push(fs.openSync(file, 'wx', 0o600));
            created.push(file);
        }
        const passwords = Object.fromEntries(DEMO_ROLES.map(role => [role, crypto.randomBytes(24).toString('base64url') + '!8a']));
        const hashes = {};
        for (const role of DEMO_ROLES) hashes[role] = await bcrypt.hash(passwords[role], 12);
        fs.writeFileSync(handles[0], buildDemoSeedSql(hashes));
        fs.writeFileSync(handles[1], `PRIVATE — synthetic demonstration accounts only. Never reuse these passwords.\n\n${DEMO_ROLES.map(role => `${role}@demo.invalid\nPassword: ${passwords[role]}\n`).join('\n')}\nAdditional synthetic patients (same private password as patient@demo.invalid):\n${EXTRA_PATIENT_EMAILS.join('\n')}\n`);
        console.log('Synthetic seed SQL and private account credentials created under .local. No database connection was made.');
        return { sqlPath, credentialsPath };
    } catch (error) {
        for (const handle of handles) fs.closeSync(handle);
        handles.length = 0;
        for (const file of created) fs.unlinkSync(file);
        throw error;
    } finally {
        for (const handle of handles) fs.closeSync(handle);
    }
}

if (require.main === module) main().catch(error => { console.error(`Synthetic seed export failed: ${error.message}`); process.exitCode = 1; });
module.exports = { DEMO_ROLES, EXTRA_PATIENT_EMAILS, buildDemoSeedSql, seedHostedDemo, main };
