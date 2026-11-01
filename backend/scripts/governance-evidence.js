const fs = require('node:fs');
const path = require('node:path');
const fail = message => { throw new Error(`Governance evidence: ${message}`); };
const text = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`${label} is required`); };
const list = (values, label) => { if (!Array.isArray(values) || !values.length) fail(`${label} is required`); };
const unique = (values, label) => { if (new Set(values).size !== values.length) fail(`duplicate ${label}`); };
function reference(root, name) {
    if (typeof name !== 'string' || !name || name.includes('\\') || path.isAbsolute(name) || name.split('/').some(part => !part || part === '.' || part === '..')) fail('unsafe reference path');
    let current = root;
    for (const part of name.split('/')) {
        current = path.join(current, part);
        let stat;
        try { stat = fs.lstatSync(current); } catch { fail(`missing reference ${name}`); }
        if (stat.isSymbolicLink()) fail('unsafe reference path');
    }
    const stat = fs.statSync(current);
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) fail(`unsupported reference ${name}`);
    return fs.readFileSync(current, 'utf8');
}
function checkInventory(inventory) {
    if (inventory?.schemaVersion !== 1) fail('unsupported inventory version');
    list(inventory.tables, 'table inventory'); unique(inventory.tables.map(table => table.name), 'table');
    for (const table of inventory.tables) {
        if (!/^[a-z_][a-z0-9_]*$/.test(table.name)) fail('invalid table name');
        list(table.columns, `${table.name} columns`); unique(table.columns, 'column');
        if (table.columns.some(column => typeof column !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(column))) fail('invalid column name');
        if (!['clinical','identity','security','governance','operational','public'].includes(table.classification)) fail(`${table.name} classification is required`);
        for (const field of ['ownerRole','retention']) text(table[field], `${table.name} ${field}`);
        for (const field of ['purposes','audience']) { list(table[field], `${table.name} ${field}`); table[field].forEach(value => text(value, field)); }
        if (!['none','selected_fields','ciphertext'].includes(table.applicationEncryption)) fail('application encryption boundary is required');
        if (!Array.isArray(table.encryptedColumns) || table.encryptedColumns.some(column => !table.columns.includes(column))) fail('invalid encrypted column classification');
        if (table.applicationEncryption !== 'none' && !table.encryptedColumns.length) fail('encrypted columns are required');
        if (table.providerEncryption !== 'requires_provider_evidence') fail('provider encryption must remain a separate evidence requirement');
        if (table.columnOverrides !== undefined) {
            if (!table.columnOverrides || Array.isArray(table.columnOverrides) || typeof table.columnOverrides !== 'object') fail('invalid column overrides');
            for (const [column, override] of Object.entries(table.columnOverrides)) {
                if (!table.columns.includes(column)) fail('override refers to an unknown column');
                if (!['clinical','identity','security','governance','operational','public'].includes(override.classification)) fail('column override classification is required');
                text(override.protection, 'column protection');
            }
        }
    }
    list(inventory.stores, 'non-table store inventory'); unique(inventory.stores.map(store => store.id), 'store');
    for (const store of inventory.stores) for (const field of ['id','classification','purpose','protection','retention','assurance']) text(store[field], `store ${field}`);
}
async function verifyCatalog(client, inventory, schema = 'public') {
    checkInventory(inventory);
    if (!['public','healthcare'].includes(schema)) fail('unsupported application schema');
    const rows = (await client.query(`SELECT c.relname AS table_name,a.attname AS column_name
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
        WHERE n.nspname=$1 AND c.relkind IN ('r','p') ORDER BY c.relname,a.attname`, [schema])).rows;
    const actual = new Map();
    for (const row of rows) {
        if (!actual.has(row.table_name)) actual.set(row.table_name, []);
        actual.get(row.table_name).push(row.column_name);
    }
    const expected = inventory.tables.map(table => table.name).sort();
    if (JSON.stringify([...actual.keys()].sort()) !== JSON.stringify(expected)) fail('table inventory differs from migrated catalog');
    for (const table of inventory.tables) if (JSON.stringify(actual.get(table.name).slice().sort()) !== JSON.stringify(table.columns.slice().sort())) fail(`column inventory differs for ${table.name}`);
    return { tables: actual.size, columns: rows.length };
}
function checkEvidence({ root, inventory, controls }) {
    root = fs.realpathSync(root); checkInventory(inventory);
    if (controls?.schemaVersion !== 1) fail('unsupported control matrix version');
    list(controls.controls, 'controls'); unique(controls.controls.map(control => control.id), 'control ID');
    let externalPending = 0;
    for (const control of controls.controls) {
        if (!/^[A-Z][A-Z0-9_-]+$/.test(control.id)) fail('stable control ID is required');
        text(control.ownerRole, 'control owner'); list(control.principles, 'framework/principle references');
        if (!['implemented','partial'].includes(control.implementation?.status)) fail('implementation status must not claim operational compliance');
        list(control.implementation.sources, 'implementation references');
        control.implementation.sources.forEach(file => reference(root, file));
        list(control.implementation.limitations, 'implementation limitations');
        list(control.verification?.scenarios, 'verification scenarios');
        for (const scenario of control.verification.scenarios) {
            text(scenario.title, 'scenario title');
            if (!reference(root, scenario.file).includes(scenario.title)) fail(`missing scenario ${scenario.title}`);
        }
        if (!Array.isArray(control.verification.observations)) fail('observed executions must be explicit');
        for (const observation of control.verification.observations) {
            if (!/^[a-f0-9]{40}$/.test(observation.revision) || !Number.isFinite(Date.parse(observation.observedAt)) || !['automated_execution','live_drill'].includes(observation.kind)) fail('observed execution needs revision, date and evidence kind');
            reference(root, observation.evidence);
        }
        if (!Array.isArray(control.externalRequirements)) fail('external requirements must be explicit');
        for (const requirement of control.externalRequirements) {
            text(requirement.id, 'external requirement ID'); text(requirement.ownerRole, 'external owner');
            if (!['pending','owner_recorded'].includes(requirement.status)) fail('external evidence status cannot assert machine verification');
            if (!Array.isArray(requirement.evidence)) fail('external evidence references must be explicit');
            if (requirement.status === 'pending') externalPending++;
            else if (!requirement.evidence.length || !requirement.recordedBy || !Number.isFinite(Date.parse(requirement.recordedAt))) fail('owner assertion needs evidence, attribution and date');
            requirement.evidence.forEach(file => reference(root, file));
        }
    }
    return { tables: inventory.tables.length, columns: inventory.tables.reduce((total, table) => total + table.columns.length, 0), controls: controls.controls.length, externalPending, verification: 'references_checked_only' };
}
function main() {
    const root = path.resolve(__dirname, '../..');
    const read = name => JSON.parse(fs.readFileSync(path.join(root, `docs/compliance/${name}.json`), 'utf8'));
    process.stdout.write(JSON.stringify(checkEvidence({ root, inventory: read('data-inventory'), controls: read('control-matrix') })) + '\n');
}
if (require.main === module) { try { main(); } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; } }
module.exports = { checkEvidence, verifyCatalog };
