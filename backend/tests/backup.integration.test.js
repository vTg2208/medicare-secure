const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createBackup, restoreBackup, inspectBundle, encryptionKey } = require('../scripts/backup-helper');

const applicationKey = 'a'.repeat(64);
const backupKey = 'b'.repeat(64);
const backupEnvironment = root => ({ ...process.env, ENCRYPTION_KEY: applicationKey, BACKUP_ENCRYPTION_KEY: backupKey,
    BACKUP_QUIESCED: 'true', UPLOAD_PATH: path.join(root, 'uploads'), DB_HOST: '127.0.0.1', DB_PORT: '55432', DB_NAME: 'synthetic_fixture', DB_USER: 'fixture' });
const restoreEnvironment = (name = `healthcare_restore_fixture_${process.pid}`) => ({ ...process.env, ENCRYPTION_KEY: applicationKey,
    BACKUP_ENCRYPTION_KEY: backupKey, RESTORE_DISPOSABLE: 'true', RESTORE_DB_HOST: '127.0.0.1', RESTORE_DB_PORT: '55432',
    RESTORE_DB_NAME: name, RESTORE_DB_USER: 'fixture', PGSSLMODE: 'disable' });
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const integer = number => { const buffer = Buffer.alloc(4); buffer.writeUInt32BE(number); return buffer; };

async function temporary(run) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shms-backup-test-'));
    try { return await run(root); }
    finally {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('shms-backup-test-'));
        await fs.rm(root, { recursive: true, force: true });
    }
}

function encryptedUpload(bytes, context) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(applicationKey, 'hex'), iv);
    cipher.setAAD(Buffer.from(context));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([Buffer.from('SHMSENC2'), iv, cipher.getAuthTag(), ciphertext]);
}

function fixtureBundle(entries, { incorrectHash = false } = {}) {
    const manifest = { version: 1, sourceUploadRoot: '/synthetic/uploads', entries: entries.map(entry => ({ path: entry.path, size: entry.data.length, sha256: digest(entry.data) })) };
    if (incorrectHash) manifest.entries[0].sha256 = '0'.repeat(64);
    const chunks = [];
    for (const entry of [...entries, { path: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) }]) {
        const header = Buffer.from(JSON.stringify({ path: entry.path }));
        chunks.push(integer(header.length), header, integer(entry.data.length), entry.data, integer(0));
    }
    chunks.push(integer(0));
    const header = Buffer.concat([Buffer.from('SHMSBKP1'), crypto.randomBytes(12)]);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(backupKey, 'hex'), header.subarray(8));
    cipher.setAAD(header);
    return Buffer.concat([header, cipher.update(Buffer.concat(chunks)), cipher.final(), cipher.getAuthTag()]);
}

test('backup keys must be present, valid and separate from the application key', () => {
    assert.throws(() => encryptionKey({}), /separately configured/);
    assert.throws(() => encryptionKey({ ENCRYPTION_KEY: applicationKey, BACKUP_ENCRYPTION_KEY: applicationKey.toUpperCase() }), /must differ/);
    assert.throws(() => encryptionKey({ ENCRYPTION_KEY: applicationKey, BACKUP_ENCRYPTION_KEY: 'short' }), /separately configured/);
});

test('authenticated bundles reject changed checksums and traversal before opening a database', async () => temporary(async root => {
    for (const [name, bytes, expected] of [
        ['checksum', fixtureBundle([{ path: 'database.dump', data: Buffer.from('synthetic dump') }], { incorrectHash: true }), /checksum/],
        ['traversal', fixtureBundle([{ path: 'database.dump', data: Buffer.from('synthetic dump') }, { path: 'uploads/../../outside.pdf', data: Buffer.from('synthetic') }]), /Unsafe|allowlist/],
        ['absolute', fixtureBundle([{ path: 'database.dump', data: Buffer.from('synthetic dump') }, { path: 'uploads/C:/outside.pdf', data: Buffer.from('synthetic') }]), /Unsafe|allowlist/],
    ]) {
        const input = path.join(root, `${name}.backup`); const uploads = path.join(root, name);
        await fs.writeFile(input, bytes);
        await assert.rejects(restoreBackup({ input, uploads, env: restoreEnvironment() }), expected);
        await assert.rejects(fs.stat(uploads), { code: 'ENOENT' });
    }
}));

test('wrong keys, modified authentication tags and truncation cannot publish files', async () => temporary(async root => {
    const valid = fixtureBundle([{ path: 'database.dump', data: Buffer.from('synthetic dump') }]);
    for (const variant of ['wrong-key', 'tampered', 'truncated']) {
        const input = path.join(root, `${variant}.backup`); const uploads = path.join(root, variant);
        const bytes = Buffer.from(valid);
        if (variant === 'tampered') bytes[bytes.length - 1] ^= 1;
        await fs.writeFile(input, variant === 'truncated' ? bytes.subarray(0, bytes.length - 6) : bytes);
        const env = restoreEnvironment(); if (variant === 'wrong-key') env.BACKUP_ENCRYPTION_KEY = 'c'.repeat(64);
        await assert.rejects(restoreBackup({ input, uploads, env }));
        await assert.rejects(fs.stat(uploads), { code: 'ENOENT' });
    }
}));

test('failed pg_dump never publishes a backup or leaves a partial artifact', async () => temporary(async root => {
    await fs.mkdir(path.join(root, 'uploads'));
    const binary = path.join(root, 'failing-dump');
    await fs.writeFile(binary, '#!/bin/sh\nprintf synthetic-partial-dump\nexit 7\n', { mode: 0o700 });
    const output = path.join(root, 'failed.backup');
    await assert.rejects(createBackup({ output, env: backupEnvironment(root), dumpCommand: { file: '/bin/sh', args: [binary] } }), /tool failed/);
    assert.deepEqual((await fs.readdir(root)).filter(name => name.startsWith('failed.backup')), []);
}));

test('only encrypted clinical uploads enter the bundle; source secrets and symlinks are refused', async () => temporary(async root => {
    await fs.mkdir(path.join(root, 'uploads', 'documents'), { recursive: true });
    const output = path.join(root, 'never.backup');
    await fs.writeFile(path.join(root, 'uploads', '.env'), 'SYNTHETIC_SECRET=excluded');
    await assert.rejects(createBackup({ output, env: backupEnvironment(root) }), /Unsafe|allowlist/);
    await fs.unlink(path.join(root, 'uploads', '.env'));
    await fs.writeFile(path.join(root, 'outside.pdf'), 'synthetic plaintext');
    await fs.symlink(path.join(root, 'outside.pdf'), path.join(root, 'uploads', 'documents', 'link.pdf'));
    await assert.rejects(createBackup({ output, env: backupEnvironment(root) }), /Symbolic/);
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
}));

const dbEnabled = process.env.RUN_BACKUP_DB_TESTS === 'true' || process.env.RUN_DB_TESTS === 'true';
test('actual PostgreSQL backup/restore preserves clinical data and encrypted uploads; failures leave no target', { skip: !dbEnabled, timeout: 120000 }, async () => temporary(async root => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST));
    const { Client } = require('pg');
    const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const suffix = `${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
    const sourceName = `healthcare_backup_test_${suffix}`;
    const targetName = `healthcare_restore_test_${suffix}`;
    const occupiedName = `healthcare_restore_occupied_${suffix}`;
    const failedName = `healthcare_restore_failed_${suffix}`;
    const admin = new Client(config); await admin.connect();
    const opened = [];
    try {
        await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
        await admin.query(`CREATE DATABASE "${occupiedName}" TEMPLATE template0`);
        const source = new Client({ ...config, database: sourceName }); await source.connect(); opened.push(source);
        const occupied = new Client({ ...config, database: occupiedName }); await occupied.connect(); opened.push(occupied);
        await occupied.query('CREATE TABLE sentinel(id integer); INSERT INTO sentinel VALUES(99)');
        const relative = 'documents/1700000000000-synthetic.pdf';
        const uploads = path.join(root, 'uploads'); await fs.mkdir(path.join(uploads, 'documents'), { recursive: true });
        const plaintext = Buffer.from('%PDF-1.4\nSynthetic patient report for recovery drill');
        const ciphertext = encryptedUpload(plaintext, relative);
        await fs.writeFile(path.join(uploads, ...relative.split('/')), ciphertext);
        await source.query('CREATE TABLE clinical_fixture(patient_id integer PRIMARY KEY, diagnosis text); INSERT INTO clinical_fixture VALUES(1,\'Synthetic diagnosis\')');
        await source.query('CREATE TABLE verification_documents(id text PRIMARY KEY,file_path text NOT NULL)');
        await source.query('INSERT INTO verification_documents VALUES($1,$2)', ['synthetic-document', path.join(uploads, ...relative.split('/'))]);
        const env = { ...backupEnvironment(root), DB_HOST: config.host, DB_PORT: String(config.port), DB_NAME: sourceName, DB_USER: config.user, DB_PASSWORD: config.password, PGSSLMODE: 'disable' };
        const output = path.join(root, 'complete.backup');
        await createBackup({ output, env });
        const artifact = await fs.readFile(output);
        assert.ok(!artifact.includes(Buffer.from('Synthetic diagnosis')));
        assert.ok(!artifact.includes(plaintext));
        const manifest = await inspectBundle(output, Buffer.from(backupKey, 'hex'));
        assert.equal(manifest.entries.length, 2);
        assert.equal(manifest.entries[1].sha256, digest(ciphertext));
        await assert.rejects(createBackup({ output, env }), { code: 'EEXIST' });
        assert.deepEqual(await fs.readFile(output), artifact);
        const restoreEnv = name => ({ ...restoreEnvironment(name), RESTORE_DB_HOST: config.host, RESTORE_DB_PORT: String(config.port),
            RESTORE_DB_USER: config.user, RESTORE_DB_PASSWORD: config.password, RESTORE_ADMIN_DB: config.database });
        const recoveredUploads = path.join(root, 'recovered-uploads');
        await restoreBackup({ input: output, uploads: recoveredUploads, env: restoreEnv(targetName) });
        const recovered = new Client({ ...config, database: targetName }); await recovered.connect(); opened.push(recovered);
        assert.deepEqual((await recovered.query('SELECT * FROM clinical_fixture')).rows, [{ patient_id: 1, diagnosis: 'Synthetic diagnosis' }]);
        const stored = await fs.readFile(path.join(recoveredUploads, ...relative.split('/')));
        assert.deepEqual(stored, ciphertext);
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(applicationKey, 'hex'), stored.subarray(8, 20));
        decipher.setAAD(Buffer.from(relative)); decipher.setAuthTag(stored.subarray(20, 36));
        assert.deepEqual(Buffer.concat([decipher.update(stored.subarray(36)), decipher.final()]), plaintext);
        assert.equal((await recovered.query('SELECT file_path FROM verification_documents')).rows[0].file_path, path.join(recoveredUploads, ...relative.split('/')));
        await assert.rejects(restoreBackup({ input: output, uploads: path.join(root, 'refused-uploads'), env: restoreEnv(occupiedName) }), /existing databases/);
        assert.deepEqual((await occupied.query('SELECT * FROM sentinel')).rows, [{ id: 99 }]);
        const failingRestore = path.join(root, 'failing-restore');
        const appliedMarker = path.join(root, 'partial-restore-applied');
        await fs.writeFile(failingRestore, '#!/bin/sh\npsql --no-password -v ON_ERROR_STOP=1 -c "CREATE TABLE partial_restore(id integer)" || exit 89\nprintf applied > "$1"\ncat >/dev/null\nexit 7\n', { mode: 0o700 });
        const failedUploads = path.join(root, 'failed-uploads');
        await assert.rejects(restoreBackup({ input: output, uploads: failedUploads, env: restoreEnv(failedName), restoreCommand: { file: '/bin/sh', args: [failingRestore, appliedMarker] } }), /tool failed/);
        assert.equal(await fs.readFile(appliedMarker, 'utf8'), 'applied');
        assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [failedName])).rows.length, 0);
        await assert.rejects(fs.stat(failedUploads), { code: 'ENOENT' });
    } finally {
        for (const client of opened) await client.end().catch(() => {});
        for (const database of [sourceName, targetName, occupiedName, failedName]) {
            assert.match(database, /^healthcare_(backup_test|restore_(test|occupied|failed))_[a-z0-9_]+$/);
            await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
        }
        await admin.end();
    }
}));

test('private healthcare schema recovery rebases credential references used by the application search path', { skip: !dbEnabled, timeout: 120000 }, async t => temporary(async root => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST));
    const { Client } = require('pg');
    const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const suffix = `${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
    const sourceName = `healthcare_backup_test_${suffix}`;
    const targetName = `healthcare_restore_private_${suffix}`;
    const admin = new Client(config); await admin.connect();
    let source; let application;
    try {
        await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
        source = new Client({ ...config, database: sourceName }); await source.connect();
        await source.query('CREATE SCHEMA healthcare; SET search_path = healthcare, public');
        await admin.query(`ALTER DATABASE "${sourceName}" SET search_path = healthcare, public`);
        assert.equal((await source.query('SELECT current_schema() AS schema')).rows[0].schema, 'healthcare');
        await source.query("CREATE TABLE clinical_fixture(patient_id integer PRIMARY KEY,diagnosis text); INSERT INTO clinical_fixture VALUES(7,'Synthetic private-schema diagnosis')");
        await source.query('CREATE TABLE verification_documents(id text PRIMARY KEY,file_path text NOT NULL)');
        const relative = 'documents/1700000000000-private-credential.pdf';
        const plaintext = Buffer.from('%PDF-1.4\nSynthetic private-schema credential');
        const ciphertext = encryptedUpload(plaintext, relative);
        const uploads = path.join(root, 'uploads'); await fs.mkdir(path.join(uploads, 'documents'), { recursive: true });
        await fs.writeFile(path.join(uploads, ...relative.split('/')), ciphertext);
        await source.query('INSERT INTO verification_documents VALUES($1,$2)', ['private-credential', path.join(uploads, ...relative.split('/'))]);
        const input = path.join(root, 'private.backup');
        await createBackup({ output: input, env: { ...backupEnvironment(root), DB_HOST: config.host, DB_PORT: String(config.port),
            DB_NAME: sourceName, DB_USER: config.user, DB_PASSWORD: config.password, PGSSLMODE: 'disable' } });
        // Remove the old path within this synthetic fixture so stale references cannot accidentally pass a download check.
        const offlineOriginal = path.join(root, 'offline-original-uploads');
        assert.equal(path.dirname(uploads), root); assert.equal(path.dirname(offlineOriginal), root);
        await fs.rename(uploads, offlineOriginal);
        const recoveredUploads = path.join(root, 'recovered-private-uploads');
        await restoreBackup({ input, uploads: recoveredUploads, env: { ...restoreEnvironment(targetName), RESTORE_DB_HOST: config.host,
            RESTORE_DB_PORT: String(config.port), RESTORE_DB_USER: config.user, RESTORE_DB_PASSWORD: config.password, RESTORE_ADMIN_DB: config.database } });
        application = new Client({ ...config, database: targetName, options: '-c search_path=healthcare,public' }); await application.connect();
        await t.test('private application records restore under healthcare search_path', async () => {
            assert.equal((await application.query('SELECT current_schema() AS schema')).rows[0].schema, 'healthcare');
            assert.deepEqual((await application.query('SELECT * FROM clinical_fixture')).rows, [{ patient_id: 7, diagnosis: 'Synthetic private-schema diagnosis' }]);
        });
        await t.test('private credential reference is rebased to the fresh upload directory', async () => {
            const document = (await application.query('SELECT file_path FROM verification_documents WHERE id=$1', ['private-credential'])).rows[0];
            assert.equal(document.file_path, path.join(recoveredUploads, ...relative.split('/')));
        });
        await t.test('the private application reference resolves and decrypts the restored credential', async () => {
            const document = (await application.query('SELECT file_path FROM verification_documents WHERE id=$1', ['private-credential'])).rows[0];
            const stored = await fs.readFile(document.file_path);
            assert.deepEqual(stored, ciphertext);
            const context = path.relative(recoveredUploads, document.file_path).split(path.sep).join('/');
            const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(applicationKey, 'hex'), stored.subarray(8, 20));
            decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(stored.subarray(20, 36));
            assert.deepEqual(Buffer.concat([decipher.update(stored.subarray(36)), decipher.final()]), plaintext);
        });
    } finally {
        if (application) await application.end().catch(() => {});
        if (source) await source.end().catch(() => {});
        for (const database of [sourceName, targetName]) {
            assert.match(database, /^healthcare_(backup_test|restore_private)_[a-z0-9_]+$/);
            await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
        }
        await admin.end();
    }
}));

test('credential schema ambiguity and unsupported references fail recovery and remove only the new drill targets', { skip: !dbEnabled, timeout: 120000 }, async t => temporary(async root => {
    assert.equal(process.env.NODE_ENV, 'test');
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST));
    const { Client } = require('pg');
    const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: false };
    const suffix = `${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
    const sourceName = `healthcare_backup_test_${suffix}`;
    const admin = new Client(config); await admin.connect();
    let source; const targets = [];
    try {
        await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
        source = new Client({ ...config, database: sourceName }); await source.connect();
        await source.query('CREATE SCHEMA healthcare; CREATE SCHEMA unsupported_application');
        const uploads = path.join(root, 'uploads'); await fs.mkdir(path.join(uploads, 'documents'), { recursive: true });
        await fs.writeFile(path.join(uploads, 'documents', 'credential.pdf'), encryptedUpload(Buffer.from('%PDF-1.4\nSynthetic credential'), 'documents/credential.pdf'));
        async function refused(name, setup, expected) {
            await source.query(setup);
            const input = path.join(root, `${name}.backup`);
            await createBackup({ output: input, env: { ...backupEnvironment(root), DB_HOST: config.host, DB_PORT: String(config.port),
                DB_NAME: sourceName, DB_USER: config.user, DB_PASSWORD: config.password, PGSSLMODE: 'disable' } });
            const target = `healthcare_restore_${name}_${suffix}`; targets.push(target);
            const destination = path.join(root, `${name}-uploads`);
            await assert.rejects(restoreBackup({ input, uploads: destination, env: { ...restoreEnvironment(target), RESTORE_DB_HOST: config.host,
                RESTORE_DB_PORT: String(config.port), RESTORE_DB_USER: config.user, RESTORE_DB_PASSWORD: config.password,
                RESTORE_ADMIN_DB: config.database } }), expected);
            assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [target])).rows.length, 0);
            await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
        }
        await t.test('two credential tables are ambiguous even when the public shadow table is empty', () => refused('ambiguous',
            'CREATE TABLE public.verification_documents(id text,file_path text); CREATE TABLE healthcare.verification_documents(id text,file_path text)', /schema is ambiguous/));
        await t.test('a credential table in an unsupported schema is refused', () => refused('unsupported',
            'DROP TABLE public.verification_documents; DROP TABLE healthcare.verification_documents; CREATE TABLE unsupported_application.verification_documents(id text,file_path text)', /unsupported application schema/));
        await t.test('credential uploads cannot silently restore without a credential table', () => refused('missing',
            'DROP TABLE unsupported_application.verification_documents', /without a supported credential table/));
        await t.test('a private credential reference outside the backed-up upload root is refused', () => refused('reference',
            "CREATE TABLE healthcare.verification_documents(id text,file_path text); INSERT INTO healthcare.verification_documents VALUES('synthetic','/outside-the-backup/credential.pdf')", /outside the backed-up upload root/));
    } finally {
        if (source) await source.end().catch(() => {});
        for (const database of [sourceName, ...targets]) {
            assert.match(database, /^healthcare_(backup_test|restore_(ambiguous|unsupported|missing|reference))_[a-z0-9_]+$/);
            await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
        }
        await admin.end();
    }
}));
