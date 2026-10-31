require('../src/database/demo-seed-guard')();
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
});

async function seedReceptionist() {
    try {
        console.log('Adding receptionist role...');
        await pool.query(`
      INSERT INTO roles (name, description) 
      VALUES ('receptionist', 'Receptionist - Front desk and patient intake')
      ON CONFLICT (name) DO NOTHING;
    `);

        // Get the role ID
        const roleResult = await pool.query('SELECT id FROM roles WHERE name = $1', ['receptionist']);
        const roleId = roleResult.rows[0].id;

        // Add a receptionist user
        const passwordHash = await bcrypt.hash('Receptionist@123', 10);
        const email = 'receptionist@medicare.com';

        // Check if user exists
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        if (userExists.rows.length === 0) {
            await pool.query(`
        INSERT INTO users (
          email, 
          password_hash, 
          first_name, 
          last_name, 
          role_id, 
          is_verified, 
          status
        ) VALUES ($1, $2, $3, $4, $5, true, 'active')
      `, [email, passwordHash, 'Front', 'Desk', roleId]);

            console.log('✅ Receptionist user created successfully');
            console.log('Email: receptionist@medicare.com');
            console.log('Password: Receptionist@123');
        } else {
            console.log('ℹ️ Receptionist user already exists');
            console.log('Email: receptionist@medicare.com');
            console.log('Password: Receptionist@123');
        }
    } catch (error) {
        console.error('Error seeding receptionist:', error);
    } finally {
        await pool.end();
    }
}

seedReceptionist();
