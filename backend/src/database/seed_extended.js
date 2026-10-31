require('./demo-seed-guard')();
/**
 * Extended Seed Script
 * Adds comprehensive demo data to Supabase:
 *   - 6 patients
 *   - 2 doctors per specialty (Cardiology, Pediatrics, General Practice, Orthopedics, Neurology, Dermatology)
 *   - 6 nurses
 *   - 1 hospital admin
 *   - 3 lab technicians, 3 pharmacists, 3 radiologists
 *   - 1 compliance officer, 1 insurance officer
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const isSupabase = process.env.DB_HOST && !process.env.DB_HOST.includes('localhost');
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
});

// ─── Passwords ────────────────────────────────────────────────────────────────
const PASSWORDS = {
    patient: 'Patient@123',
    doctor: 'Doctor@123',
    nurse: 'Nurse@123',
    admin: 'Admin@123',
    staff: 'Staff@123',
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const PATIENTS = [
    { email: 'alice.martin@patient.com', firstName: 'Alice', lastName: 'Martin', dob: '1988-03-15', gender: 'female', uhid: 'UHID-001' },
    { email: 'bob.sharma@patient.com', firstName: 'Bob', lastName: 'Sharma', dob: '1975-07-22', gender: 'male', uhid: 'UHID-002' },
    { email: 'clara.jones@patient.com', firstName: 'Clara', lastName: 'Jones', dob: '1995-11-08', gender: 'female', uhid: 'UHID-003' },
    { email: 'david.lee@patient.com', firstName: 'David', lastName: 'Lee', dob: '1960-02-14', gender: 'male', uhid: 'UHID-004' },
    { email: 'emma.wilson@patient.com', firstName: 'Emma', lastName: 'Wilson', dob: '2000-06-30', gender: 'female', uhid: 'UHID-005' },
    { email: 'frank.chen@patient.com', firstName: 'Frank', lastName: 'Chen', dob: '1983-09-05', gender: 'male', uhid: 'UHID-006' },
];

const DOCTORS = [
    // Cardiology (2)
    { email: 'dr.arjun.mehta@hospital.com', firstName: 'Arjun', lastName: 'Mehta', specialization: 'Cardiology', license: 'LIC-CARD-001' },
    { email: 'dr.priya.nair@hospital.com', firstName: 'Priya', lastName: 'Nair', specialization: 'Cardiology', license: 'LIC-CARD-002' },
    // Pediatrics (2)
    { email: 'dr.sofia.patel@hospital.com', firstName: 'Sofia', lastName: 'Patel', specialization: 'Pediatrics', license: 'LIC-PED-001' },
    { email: 'dr.james.wright@hospital.com', firstName: 'James', lastName: 'Wright', specialization: 'Pediatrics', license: 'LIC-PED-002' },
    // General Practice (2)
    { email: 'dr.lena.carter@hospital.com', firstName: 'Lena', lastName: 'Carter', specialization: 'General Practice', license: 'LIC-GP-001' },
    { email: 'dr.ravi.kumar@hospital.com', firstName: 'Ravi', lastName: 'Kumar', specialization: 'General Practice', license: 'LIC-GP-002' },
    // Orthopedics (2)
    { email: 'dr.mike.adams@hospital.com', firstName: 'Mike', lastName: 'Adams', specialization: 'Orthopedics', license: 'LIC-ORTH-001' },
    { email: 'dr.ana.silva@hospital.com', firstName: 'Ana', lastName: 'Silva', specialization: 'Orthopedics', license: 'LIC-ORTH-002' },
    // Neurology (2)
    { email: 'dr.omar.hassan@hospital.com', firstName: 'Omar', lastName: 'Hassan', specialization: 'Neurology', license: 'LIC-NEURO-001' },
    { email: 'dr.nina.jones@hospital.com', firstName: 'Nina', lastName: 'Jones', specialization: 'Neurology', license: 'LIC-NEURO-002' },
    // Dermatology (2)
    { email: 'dr.lily.tan@hospital.com', firstName: 'Lily', lastName: 'Tan', specialization: 'Dermatology', license: 'LIC-DERM-001' },
    { email: 'dr.sam.brooks@hospital.com', firstName: 'Sam', lastName: 'Brooks', specialization: 'Dermatology', license: 'LIC-DERM-002' },
];

const NURSES = [
    { email: 'nurse.maya@hospital.com', firstName: 'Maya', lastName: 'Gupta' },
    { email: 'nurse.tina@hospital.com', firstName: 'Tina', lastName: 'Ross' },
    { email: 'nurse.kevin@hospital.com', firstName: 'Kevin', lastName: 'Morris' },
    { email: 'nurse.anna@hospital.com', firstName: 'Anna', lastName: 'Bell' },
    { email: 'nurse.raj@hospital.com', firstName: 'Raj', lastName: 'Pillai' },
    { email: 'nurse.diana@hospital.com', firstName: 'Diana', lastName: 'Spencer' },
];

const LAB_TECHS = [
    { email: 'lab.tech1@hospital.com', firstName: 'Chris', lastName: 'Webb' },
    { email: 'lab.tech2@hospital.com', firstName: 'Rachel', lastName: 'Park' },
    { email: 'lab.tech3@hospital.com', firstName: 'Patrick', lastName: 'Stone' },
];

const PHARMACISTS = [
    { email: 'pharmacist1@hospital.com', firstName: 'Grace', lastName: 'Hunt' },
    { email: 'pharmacist2@hospital.com', firstName: 'Leo', lastName: 'Grant' },
    { email: 'pharmacist3@hospital.com', firstName: 'Nora', lastName: 'Kim' },
];

const RADIOLOGISTS = [
    { email: 'radiologist1@hospital.com', firstName: 'Victor', lastName: 'Reyes' },
    { email: 'radiologist2@hospital.com', firstName: 'Luna', lastName: 'Torres' },
    { email: 'radiologist3@hospital.com', firstName: 'Ethan', lastName: 'Price' },
];

const HOSPITAL_ADMIN = { email: 'hospitaladmin@hospital.com', firstName: 'Sandra', lastName: 'Reed' };
const COMPLIANCE_OFFICER = { email: 'compliance@hospital.com', firstName: 'Mark', lastName: 'Lawson' };
const INSURANCE_OFFICER = { email: 'insurance@hospital.com', firstName: 'Helen', lastName: 'Ford' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getRoleId(name) {
    const res = await pool.query('SELECT id FROM roles WHERE name = $1', [name]);
    if (!res.rows[0]) throw new Error(`Role '${name}' not found — did you run the main seed first?`);
    return res.rows[0].id;
}

async function getOrg() {
    const res = await pool.query("SELECT id FROM organizations LIMIT 1");
    if (!res.rows[0]) throw new Error('No organization found — did you run the main seed first?');
    return res.rows[0].id;
}

async function upsertUser(email, hash, firstName, lastName, roleId, orgId, extraOrgFields = {}) {
    const res = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_verified, status)
         VALUES ($1,$2,$3,$4,$5,true,'active')
         ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name
         RETURNING id`,
        [email, hash, firstName, lastName, roleId]
    );
    const userId = res.rows[0].id;

    await pool.query(
        `INSERT INTO staff_org_mapping (user_id, organization_id, role_id, status, license_verified)
         VALUES ($1,$2,$3,'active',true)
         ON CONFLICT (user_id, organization_id) DO UPDATE SET status='active'`,
        [userId, orgId, roleId]
    );
    return userId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedExtended() {
    console.log('\n🚀 Starting Extended Seed...\n');

    const orgId = await getOrg();
    const patientRole = await getRoleId('patient');
    const doctorRole = await getRoleId('doctor');
    const nurseRole = await getRoleId('nurse');
    const labRole = await getRoleId('lab_technician');
    const pharmRole = await getRoleId('pharmacist');
    const radioRole = await getRoleId('radiologist');
    const adminRole = await getRoleId('hospital_admin');
    const compRole = await getRoleId('compliance_officer');
    const insRole = await getRoleId('insurance_provider');

    const patientHash = await bcrypt.hash(PASSWORDS.patient, 10);
    const doctorHash = await bcrypt.hash(PASSWORDS.doctor, 10);
    const nurseHash = await bcrypt.hash(PASSWORDS.nurse, 10);
    const adminHash = await bcrypt.hash(PASSWORDS.admin, 10);
    const staffHash = await bcrypt.hash(PASSWORDS.staff, 10);

    // ── Patients ────────────────────────────────────────────────────────────
    for (const p of PATIENTS) {
        const res = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_verified, status)
             VALUES ($1,$2,$3,$4,$5,true,'active')
             ON CONFLICT (email) DO UPDATE SET first_name=EXCLUDED.first_name RETURNING id`,
            [p.email, patientHash, p.firstName, p.lastName, patientRole]
        );
        const uid = res.rows[0].id;
        await pool.query(
            `INSERT INTO patient_profiles (user_id, unique_health_id, date_of_birth, gender, address)
             VALUES ($1,$2,$3,$4,'Demo Address')
             ON CONFLICT (user_id) DO NOTHING`,
            [uid, p.uhid, p.dob, p.gender]
        );
        console.log(`  ✅ Patient: ${p.firstName} ${p.lastName} (${p.email})`);
    }
    console.log('');

    // ── Doctors ─────────────────────────────────────────────────────────────
    for (const d of DOCTORS) {
        const uid = await upsertUser(d.email, doctorHash, d.firstName, d.lastName, doctorRole, orgId);
        await pool.query(
            `INSERT INTO doctor_profiles (user_id, specialization, license_number, experience_years)
             VALUES ($1,$2,$3,8)
             ON CONFLICT (user_id) DO NOTHING`,
            [uid, d.specialization, d.license]
        );
        console.log(`  ✅ Doctor [${d.specialization}]: Dr. ${d.firstName} ${d.lastName}`);
    }
    console.log('');

    // ── Nurses ──────────────────────────────────────────────────────────────
    for (const n of NURSES) {
        await upsertUser(n.email, nurseHash, n.firstName, n.lastName, nurseRole, orgId);
        console.log(`  ✅ Nurse: ${n.firstName} ${n.lastName}`);
    }
    console.log('');

    // ── Lab Technicians ─────────────────────────────────────────────────────
    for (const l of LAB_TECHS) {
        await upsertUser(l.email, staffHash, l.firstName, l.lastName, labRole, orgId);
        console.log(`  ✅ Lab Technician: ${l.firstName} ${l.lastName}`);
    }

    // ── Pharmacists ─────────────────────────────────────────────────────────
    for (const ph of PHARMACISTS) {
        await upsertUser(ph.email, staffHash, ph.firstName, ph.lastName, pharmRole, orgId);
        console.log(`  ✅ Pharmacist: ${ph.firstName} ${ph.lastName}`);
    }

    // ── Radiologists ────────────────────────────────────────────────────────
    for (const r of RADIOLOGISTS) {
        await upsertUser(r.email, staffHash, r.firstName, r.lastName, radioRole, orgId);
        console.log(`  ✅ Radiologist: ${r.firstName} ${r.lastName}`);
    }
    console.log('');

    // ── Hospital Admin ──────────────────────────────────────────────────────
    await upsertUser(HOSPITAL_ADMIN.email, adminHash, HOSPITAL_ADMIN.firstName, HOSPITAL_ADMIN.lastName, adminRole, orgId);
    console.log(`  ✅ Hospital Admin: ${HOSPITAL_ADMIN.firstName} ${HOSPITAL_ADMIN.lastName} (${HOSPITAL_ADMIN.email})`);

    // ── Compliance Officer ──────────────────────────────────────────────────
    await upsertUser(COMPLIANCE_OFFICER.email, staffHash, COMPLIANCE_OFFICER.firstName, COMPLIANCE_OFFICER.lastName, compRole, orgId);
    console.log(`  ✅ Compliance Officer: ${COMPLIANCE_OFFICER.firstName} ${COMPLIANCE_OFFICER.lastName}`);

    // ── Insurance Officer ───────────────────────────────────────────────────
    await upsertUser(INSURANCE_OFFICER.email, staffHash, INSURANCE_OFFICER.firstName, INSURANCE_OFFICER.lastName, insRole, orgId);
    console.log(`  ✅ Insurance Officer: ${INSURANCE_OFFICER.firstName} ${INSURANCE_OFFICER.lastName}`);

    console.log('\n🎉 Extended seed completed successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Login Credentials Summary:');
    console.log('  Patients      →  Patient@123');
    console.log('  Doctors       →  Doctor@123');
    console.log('  Nurses        →  Nurse@123');
    console.log('  Hospital Admin→  Admin@123');
    console.log('  All other staff → Staff@123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

seedExtended()
    .catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); })
    .finally(() => pool.end());
