require('./local-seed-guard')();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const config = require('../config/env');
const logger = require('../utils/logger');

const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
});

const seedDoctors = async () => {
    try {
        logger.info('🌱 Starting doctor seeding...');

        // 1. Get Doctor Role ID
        const doctorRoleRes = await pool.query("SELECT id FROM roles WHERE name = 'doctor'");
        if (doctorRoleRes.rows.length === 0) {
            throw new Error('Doctor role not found. Run base seed.js first.');
        }
        const doctorRoleId = doctorRoleRes.rows[0].id;

        // 2. Ensure Organization Exists
        let orgId;
        try {
            const orgRes = await pool.query(
                `INSERT INTO organizations (name, type, license_number, status, verified, hospital_code)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (license_number) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                ['General Hospital', 'hospital', 'ORG-1001', 'active', true, '10001']
            );
            orgId = orgRes.rows[0].id;
        } catch (err) {
            console.error('❌ Failed to seed organization:', err);
            console.error('Error details:', JSON.stringify(err, null, 2));
            process.exit(1);
        }

        // 3. Seed Doctors
        const doctors = [
            {
                email: 'dr.smith@hospital.com',
                firstName: 'John',
                lastName: 'Smith',
                license: 'LIC-MD-001',
                specialization: 'Cardiology'
            },
            {
                email: 'dr.jones@hospital.com',
                firstName: 'Sarah',
                lastName: 'Jones',
                license: 'LIC-MD-002',
                specialization: 'Pediatrics'
            },
            {
                email: 'dr.patel@hospital.com',
                firstName: 'Raj',
                lastName: 'Patel',
                license: 'LIC-MD-003',
                specialization: 'Neurology'
            }
        ];

        const hashedPassword = await bcrypt.hash('Doctor@123', 10);

        for (const dr of doctors) {
            // Create User
            const userRes = await pool.query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_verified, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (email) DO UPDATE SET status = 'active'
                 RETURNING id`,
                [dr.email, hashedPassword, dr.firstName, dr.lastName, doctorRoleId, true, 'active']
            );
            const userId = userRes.rows[0].id;

            // Map to Organization
            await pool.query(
                `INSERT INTO staff_org_mapping (user_id, organization_id, role_id, professional_license, license_verified, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, organization_id) DO NOTHING`,
                [userId, orgId, doctorRoleId, dr.license, true, 'active']
            );

            logger.info(`✅ Seeded Dr. ${dr.firstName} ${dr.lastName}`);
        }

        logger.info('✅ Doctor seeding completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Doctor seeding failed:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    seedDoctors();
}

module.exports = { seedDoctors };
