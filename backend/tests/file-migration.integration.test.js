const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { migrateFileEncryption, contextForFile } = require('../scripts/migrate-file-encryption');

const key = 'a'.repeat(64);
// Only synthetic test settings enter the existing runtime crypto implementation.
process.env.ENCRYPTION_KEY = key;
const { encryptBuffer, decryptBuffer } = require('../src/services/file.crypto');
const env = { ENCRYPTION_KEY: key, FILE_MIGRATION_QUIESCED: 'true' };
const patient = '11111111-1111-4111-8111-111111111111';

async function fixture(run) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shms-file-migration-test-'));
    const uploads = path.join(root, 'uploads'); await fs.mkdir(uploads);
    const backupDirectory = path.join(root, 'original-encrypted-backups');
    try { return await run({ root, uploads, backupDirectory }); }
    finally {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        assert.ok(path.basename(root).startsWith('shms-file-migration-test-'));
        await fs.rm(root, { recursive: true, force: true });
    }
}

async function write(root, relative, bytes) {
    const file = path.join(root, ...relative.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes);
    return file;
}

test('default dry-run authenticates legacy and current files without changing bytes or creating a backup', async () => fixture(async ({ uploads, backupDirectory }) => {
    const legacy = encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic legacy report'));
    const file = await write(uploads, 'documents/legacy.pdf', legacy);
    await write(uploads, 'documents/current.pdf', encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic current report'), 'documents/current.pdf'));
    assert.deepEqual(await migrateFileEncryption({ uploads, backupDirectory, env }), { scanned: 2, legacy: 1, upToDate: 1, migrated: 0, dryRun: true });
    assert.deepEqual(await fs.readFile(file), legacy);
    await assert.rejects(fs.stat(backupDirectory), { code: 'ENOENT' });
}));

test('apply preserves original ciphertext and paths; both medical and credential downloads accept the new identity-bound bytes', async () => fixture(async ({ uploads, backupDirectory }) => {
    const reports = [`medical_files/${patient}/lab_results/legacy.pdf`, 'documents/legacy.pdf'];
    const plaintext = Buffer.from('%PDF-1.4\nSynthetic recovery-only fixture');
    const originals = new Map();
    for (const relative of reports) {
        const original = encryptBuffer(plaintext); originals.set(relative, original); await write(uploads, relative, original);
    }
    const summary = await migrateFileEncryption({ uploads, backupDirectory, apply: true, env });
    assert.equal(summary.migrated, 2);
    const migrated = new Map();
    for (const relative of reports) {
        const file = path.join(uploads, ...relative.split('/')); const bytes = await fs.readFile(file); migrated.set(relative, bytes);
        assert.equal(bytes.subarray(0, 8).toString(), 'SHMSENC2');
        assert.deepEqual(decryptBuffer(bytes, contextForFile(uploads, file)), plaintext);
        assert.throws(() => decryptBuffer(bytes, 'documents/a-different-identity.pdf'));
        assert.deepEqual(await fs.readFile(path.join(backupDirectory, ...relative.split('/'))), originals.get(relative));
        assert.ok(!bytes.includes(plaintext));
    }
    const repeated = await migrateFileEncryption({ uploads, backupDirectory, apply: true, env });
    assert.equal(repeated.migrated, 0); assert.equal(repeated.upToDate, 2);
    for (const relative of reports) {
        assert.deepEqual(await fs.readFile(path.join(uploads, ...relative.split('/'))), migrated.get(relative));
        assert.deepEqual(await fs.readFile(path.join(backupDirectory, ...relative.split('/'))), originals.get(relative));
    }
}));

test('a tampered or wrong-key file aborts the entire preflight before any replacement', async () => fixture(async ({ uploads, backupDirectory }) => {
    const good = encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic good'));
    const damaged = encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic damaged')); damaged[damaged.length - 1] ^= 1;
    const goodFile = await write(uploads, 'documents/a-good.pdf', good);
    await write(uploads, 'documents/z-damaged.pdf', damaged);
    await assert.rejects(migrateFileEncryption({ uploads, backupDirectory, apply: true, env }), { code: 'AUTHENTICATION_FAILED' });
    assert.deepEqual(await fs.readFile(goodFile), good);
    await assert.rejects(fs.stat(backupDirectory), { code: 'ENOENT' });
    await fs.unlink(path.join(uploads, 'documents', 'z-damaged.pdf'));
    await assert.rejects(migrateFileEncryption({ uploads, backupDirectory, apply: true, env: { ...env, ENCRYPTION_KEY: 'b'.repeat(64) } }), { code: 'AUTHENTICATION_FAILED' });
    assert.deepEqual(await fs.readFile(goodFile), good);
}));

test('a current-format file copied to a different path fails identity authentication', async () => fixture(async ({ uploads }) => {
    await write(uploads, 'documents/copied.pdf', encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic'), 'documents/original.pdf'));
    await assert.rejects(migrateFileEncryption({ uploads, env }), { code: 'AUTHENTICATION_FAILED' });
}));

test('plaintext, unsupported file types and files larger than 10 MiB are refused', async () => fixture(async ({ uploads }) => {
    const plain = await write(uploads, 'documents/plain.pdf', Buffer.from('%PDF-1.4\nSynthetic plaintext'));
    await assert.rejects(migrateFileEncryption({ uploads, env }), { code: 'PLAINTEXT_REFUSED' });
    await fs.unlink(plain);
    const unsupported = await write(uploads, 'documents/secret.key', encryptBuffer(Buffer.from('synthetic')));
    await assert.rejects(migrateFileEncryption({ uploads, env }), { code: 'UNSUPPORTED_TYPE' });
    await fs.unlink(unsupported);
    const large = await write(uploads, 'documents/large.pdf', Buffer.alloc(0)); await fs.truncate(large, 10 * 1024 * 1024 + 1);
    await assert.rejects(migrateFileEncryption({ uploads, env }), { code: 'FILE_TOO_LARGE' });
}));

test('symlinked files/directories, traversal contexts and unsafe backup locations are refused', async () => fixture(async ({ root, uploads, backupDirectory }) => {
    const outside = path.join(root, 'outside.pdf'); await fs.writeFile(outside, encryptBuffer(Buffer.from('synthetic')));
    await fs.mkdir(path.join(uploads, 'documents'));
    const link = path.join(uploads, 'documents', 'link.pdf'); await fs.symlink(outside, link);
    await assert.rejects(migrateFileEncryption({ uploads, env }), { code: 'UNSAFE_PATH' });
    await fs.unlink(link);
    const directoryLink = path.join(root, 'linked-uploads'); await fs.symlink(uploads, directoryLink, 'dir');
    await assert.rejects(migrateFileEncryption({ uploads: directoryLink, env }), { code: 'UNSAFE_PATH' });
    assert.throws(() => contextForFile(uploads, path.join(uploads, '..', 'outside.pdf')), { code: 'UNSAFE_PATH' });
    await assert.rejects(migrateFileEncryption({ uploads, apply: true, backupDirectory: path.join(uploads, 'backup'), env }), { code: 'UNSAFE_BACKUP' });
    await fs.symlink(path.join(uploads, 'documents'), backupDirectory, 'dir');
    await assert.rejects(migrateFileEncryption({ uploads, apply: true, backupDirectory, env }), { code: 'UNSAFE_BACKUP' });
    await assert.rejects(migrateFileEncryption({ uploads: path.join(root, 'missing'), env }), { code: 'ENOENT' });
}));

test('different existing originals are never overwritten, and an identical original can resume a prior interrupted migration', async () => fixture(async ({ uploads, backupDirectory }) => {
    const relative = 'documents/report.pdf'; const original = encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic original'));
    const file = await write(uploads, relative, original);
    const different = encryptBuffer(Buffer.from('%PDF-1.4\nSynthetic other'));
    const backup = await write(backupDirectory, relative, different);
    await assert.rejects(migrateFileEncryption({ uploads, apply: true, backupDirectory, env }), { code: 'BACKUP_CONFLICT' });
    assert.deepEqual(await fs.readFile(file), original); assert.deepEqual(await fs.readFile(backup), different);
    await fs.unlink(backup); await fs.writeFile(backup, original);
    assert.equal((await migrateFileEncryption({ uploads, apply: true, backupDirectory, env })).migrated, 1);
    assert.deepEqual(await fs.readFile(backup), original);
}));

test('apply requires an existing key, stopped writes and an explicit outside backup location', async () => fixture(async ({ uploads, backupDirectory }) => {
    await assert.rejects(migrateFileEncryption({ uploads, env: {} }), { code: 'KEY_REQUIRED' });
    await assert.rejects(migrateFileEncryption({ uploads, apply: true, backupDirectory, env: { ENCRYPTION_KEY: key } }), { code: 'QUIESCE_REQUIRED' });
    await assert.rejects(migrateFileEncryption({ uploads, apply: true, env }), { code: 'BACKUP_REQUIRED' });
}));

test('the CLI defaults to dry-run and reports counts without keys, file identities or plaintext', async () => fixture(async ({ uploads }) => {
    await write(uploads, `medical_files/${patient}/lab_results/report.pdf`, encryptBuffer(Buffer.from('%PDF-1.4\nSensitive synthetic fixture')));
    const child = spawn(process.execPath, [path.resolve(__dirname, '../scripts/migrate-file-encryption.js'), '--uploads', uploads], {
        shell: false, windowsHide: true, env: { ...process.env, ENCRYPTION_KEY: key }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = ''; let errors = '';
    child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { errors += bytes; });
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    assert.equal(code, 0, errors); assert.match(output, /Dry run: scanned=1, legacy=1/);
    for (const secret of [key, patient, uploads, 'Sensitive synthetic fixture']) assert.ok(!output.includes(secret));
}));
