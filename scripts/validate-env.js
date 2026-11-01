#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { validateEnvironment } = require('../backend/src/config/validate-env');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
const target = option('--env') || 'dev';
if (!['dev', 'prod'].includes(target)) { console.error('Use --env dev or --env prod.'); process.exit(1); }
let dotenv;
try { dotenv = require(path.join(root, 'backend/node_modules/dotenv')); }
catch { console.error('Install backend dependencies with npm ci before validation.'); process.exit(1); }
const requestedFile = option('--file');
const file = requestedFile ? path.resolve(requestedFile) : path.join(root, target === 'prod' ? '.env.production' : 'backend/.env');
if (!fs.existsSync(file)) { console.error('Environment file was not found; specify --file or create the documented configuration.'); process.exit(1); }
const env = { ...dotenv.parse(fs.readFileSync(file)), ...process.env, NODE_ENV: target === 'prod' ? 'production' : 'development' };
const errors = validateEnvironment(env);
if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1; }
else console.log(`Environment validation passed for ${target}; no secret values were printed.`);
