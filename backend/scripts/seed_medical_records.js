require('../src/database/demo-seed-guard')();
require('dotenv').config({ path: './.env' }); // Load env vars from backend/.env
const { pool, query } = require('../src/config/db');
const { v4: uuidv4 } = require('uuid');

async function seedRecords() {
    try {
        console.log('Connecting to database...');

        // 1. Get Patient ID
        const patientRes = await query("SELECT id, first_name, last_name FROM users WHERE email = 'patient@example.com'");
        if (patientRes.rows.length === 0) {
            console.error('Patient not found. Please ensure patient@example.com exists.');
            // Don't exit process hard, just return
            return;
        }
        const patientId = patientRes.rows[0].id;
        console.log(`Found Patient: ${patientRes.rows[0].first_name} ${patientRes.rows[0].last_name} (${patientId})`);

        // 2. Get Doctor ID (any doctor)
        const doctorRes = await query("SELECT u.id, u.first_name, u.last_name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'doctor' LIMIT 1");
        let doctorId;
        if (doctorRes.rows.length === 0) {
            console.warn('No doctor found. Using system admin or creating placeholder.');
            // Fallback to system admin if no doctor
            const adminRes = await query("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'system_admin' LIMIT 1");
            if (adminRes.rows.length > 0) doctorId = adminRes.rows[0].id;
            else {
                console.error('No doctor or admin found to create records.');
                return;
            }
        } else {
            doctorId = doctorRes.rows[0].id;
            console.log(`Found Doctor: ${doctorRes.rows[0].first_name} ${doctorRes.rows[0].last_name} (${doctorId})`);
        }

        // 3. Insert Medical Records
        const records = [
            {
                type: 'consultation', // updated from visit_summary to match enum if needed, or keeping generic. Let's use 'consultation' as it matches frontend filter
                title: 'General Checkup',
                description: 'Annual physical examination. Patient reports feeling well. BP 120/80, Heart Rate 72.',
                created_at: new Date('2025-01-15T10:00:00')
            },
            {
                type: 'diagnosis',
                title: 'Seasonal Allergies',
                description: 'Patient presented with sneezing and runny nose. Diagnosed with seasonal allergic rhinitis.',
                created_at: new Date('2025-02-10T14:30:00')
            },
            {
                type: 'prescription',
                title: 'Antibiotics Course',
                description: 'Amoxicillin 500mg - 3 times a day for 7 days.',
                created_at: new Date('2025-02-12T09:15:00')
            }
        ];

        for (const rec of records) {
            const insertQuery = `
                INSERT INTO medical_records (id, patient_id, type, title, description, created_by, created_at, updated_at, immutable_flag)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $7, true)
                RETURNING id;
            `;
            const id = uuidv4();
            await query(insertQuery, [id, patientId, rec.type, rec.title, rec.description, doctorId, rec.created_at]);
            console.log(`Inserted record: ${rec.title}`);
        }

        console.log('Seeding completed successfully.');
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await pool.end();
    }
}

seedRecords();
