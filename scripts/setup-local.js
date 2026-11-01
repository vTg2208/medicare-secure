#!/usr/bin/env node
// Create missing local environment files. Existing files are never modified.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'backend/node_modules/dotenv'));
const files = [path.join(root, '.env'), path.join(root, 'backend/.env')];
const existing = files.filter(file => fs.existsSync(file));
const values = Object.assign({}, ...existing.map(file => dotenv.parse(fs.readFileSync(file))));
const secretKeys = ['DB_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'AI_SERVICE_TOKEN', 'PGADMIN_PASSWORD', 'GRAFANA_ADMIN_PASSWORD', 'METRICS_TOKEN'];
for (const key of secretKeys) if (!values[key]) values[key] = crypto.randomBytes(32).toString('hex');
for (const file of files) {
    if (fs.existsSync(file)) { console.log(`Preserved ${path.relative(root, file)}; values were not changed.`); continue; }
    const template = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    const content = template.replace(/^([A-Z][A-Z0-9_]*)=(.*)$/gm, (line, key) =>
        Object.hasOwn(values, key) ? `${key}=${JSON.stringify(values[key])}` : line);
    fs.writeFileSync(file, content, { flag: 'wx', mode: 0o600 });
    console.log(`Created ${path.relative(root, file)} with random local secrets.`);
}
console.log('Existing configuration takes precedence. Validate before startup; no secret values were printed.');
