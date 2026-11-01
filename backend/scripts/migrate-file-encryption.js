const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { uploadPath, contained } = require('./backup-helper');

const LIMIT = 10 * 1024 * 1024;
const MAX_FILES = 10000;
function fault(code, safeMessage) { return Object.assign(new Error(safeMessage), { code, safeMessage }); }
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// Exact AAD used by medical-file and credential downloads; preserve path case.
function contextForFile(uploadRoot, file) {
    const relative = path.relative(path.resolve(uploadRoot), path.resolve(file));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw fault('UNSAFE_PATH', 'A file is outside the upload directory');
    return relative.split(path.sep).join('/');
}

function decrypt(bytes, key, context) {
    const version = bytes.subarray(0, 8).toString();
    if (bytes.length < 36 || !['SHMSENC1', 'SHMSENC2'].includes(version)) throw fault('PLAINTEXT_REFUSED', 'Plaintext or unknown encryption formats cannot be migrated');
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(8, 20));
        if (version === 'SHMSENC2') decipher.setAAD(Buffer.from(context, 'utf8'));
        decipher.setAuthTag(bytes.subarray(20, 36));
        return { version, plaintext: Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]) };
    } catch { throw fault('AUTHENTICATION_FAILED', 'An encrypted file failed key, integrity or identity verification'); }
}

function encrypt(bytes, key, context) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return Buffer.concat([Buffer.from('SHMSENC2'), iv, cipher.getAuthTag(), ciphertext]);
}

async function readRegular(file) {
    const metadata = await fs.lstat(file);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw fault('UNSAFE_PATH', 'Symbolic links and non-regular files cannot be migrated');
    if (metadata.size > LIMIT) throw fault('FILE_TOO_LARGE', 'An encrypted file exceeds the 10 MiB migration limit');
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.size > LIMIT || opened.ino !== metadata.ino || opened.dev !== metadata.dev) throw fault('FILE_CHANGED', 'An upload changed while being inspected');
        const bytes = await handle.readFile();
        if (bytes.length > LIMIT) throw fault('FILE_TOO_LARGE', 'An encrypted file exceeds the 10 MiB migration limit');
        return bytes;
    } finally { await handle.close(); }
}

async function filesUnder(root) {
    const result = [];
    async function walk(directory, prefix = '') {
        for (const item of await fs.readdir(directory, { withFileTypes: true })) {
            const relative = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.isSymbolicLink()) throw fault('UNSAFE_PATH', 'Symbolic links cannot be migrated');
            if (item.isDirectory()) {
                const parts = relative.split('/');
                const allowed = relative === 'documents' || relative === 'medical_files'
                    || (parts[0] === 'medical_files' && /^[a-f\d-]{36}$/i.test(parts[1] || '')
                        && (parts.length === 2 || (parts.length === 3 && ['lab_results', 'imaging'].includes(parts[2]))));
                if (!allowed) throw fault('UNSUPPORTED_TYPE', 'An upload directory is outside the supported encrypted file layout');
                await walk(contained(root, relative), relative);
            } else {
                try { uploadPath(relative); } catch { throw fault('UNSUPPORTED_TYPE', 'An upload has an unsupported path or file type'); }
                if (!item.isFile()) throw fault('UNSAFE_PATH', 'Only regular encrypted files can be migrated');
                result.push({ relative, file: contained(root, relative) });
                if (result.length > MAX_FILES) throw fault('TOO_MANY_FILES', 'The migration exceeds the 10,000 file limit');
            }
        }
    }
    await walk(root);
    return result.sort((a, b) => a.relative.localeCompare(b.relative));
}

async function safeDirectory(root, relativeDirectory) {
    let current = root;
    for (const segment of relativeDirectory.split('/').filter(Boolean)) {
        current = path.join(current, segment);
        await fs.mkdir(current, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
        const info = await fs.lstat(current);
        if (!info.isDirectory() || info.isSymbolicLink() || await fs.realpath(current) !== current) throw fault('UNSAFE_BACKUP', 'The backup directory contains an unsafe path');
    }
}

async function exclusiveFile(file, bytes) {
    const handle = await fs.open(file, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); }
    catch (error) { await handle.close().catch(() => {}); await fs.unlink(file).catch(() => {}); throw error; }
    await handle.close();
}

async function backupLocation(uploadRoot, requested) {
    if (!requested || !path.isAbsolute(requested)) throw fault('BACKUP_REQUIRED', 'Apply requires an explicitly named absolute backup directory');
    const backup = path.resolve(requested);
    const relation = path.relative(uploadRoot, backup);
    const reverse = path.relative(backup, uploadRoot);
    if (!relation || (!relation.startsWith('..') && !path.isAbsolute(relation)) || (!reverse.startsWith('..') && !path.isAbsolute(reverse))) {
        throw fault('UNSAFE_BACKUP', 'The backup directory must be separate from the upload tree');
    }
    const parent = path.dirname(backup);
    if (await fs.realpath(parent) !== parent) throw fault('UNSAFE_BACKUP', 'The backup directory parent must not contain symbolic links');
    const existing = await fs.lstat(backup).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || await fs.realpath(backup) !== backup)) throw fault('UNSAFE_BACKUP', 'The backup directory must be a real directory');
    return backup;
}

async function migrateFileEncryption({ uploads, apply = false, backupDirectory, env = process.env } = {}) {
    if (!/^[a-f\d]{64}$/i.test(env.ENCRYPTION_KEY || '')) throw fault('KEY_REQUIRED', 'A valid existing application encryption key is required');
    const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
    const requested = uploads || env.UPLOAD_PATH;
    if (!requested || !path.isAbsolute(requested)) throw fault('UPLOAD_REQUIRED', 'An explicit absolute upload directory is required');
    const root = path.resolve(requested);
    const metadata = await fs.lstat(root);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await fs.realpath(root) !== root) throw fault('UNSAFE_PATH', 'The upload directory must be a real directory without symbolic links');
    let backup;
    if (apply) {
        if (env.FILE_MIGRATION_QUIESCED !== 'true') throw fault('QUIESCE_REQUIRED', 'Stop application writes and set FILE_MIGRATION_QUIESCED=true before applying');
        backup = await backupLocation(root, backupDirectory);
    }
    const files = await filesUnder(root);
    const summary = { scanned: files.length, legacy: 0, upToDate: 0, migrated: 0, dryRun: !apply };
    // Authenticate the complete input set before creating backups or replacing any file.
    for (const file of files) {
        const bytes = await readRegular(file.file);
        const verified = decrypt(bytes, key, contextForFile(root, file.file));
        file.version = verified.version; file.hash = digest(bytes);
        verified.plaintext.fill(0);
        if (file.version === 'SHMSENC1') summary.legacy++; else summary.upToDate++;
    }
    if (!apply || !summary.legacy) return summary;
    await fs.mkdir(backup, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    if ((await fs.lstat(backup)).isSymbolicLink() || await fs.realpath(backup) !== backup) throw fault('UNSAFE_BACKUP', 'The backup directory changed during migration');
    for (const file of files.filter(item => item.version === 'SHMSENC1')) {
        const bytes = await readRegular(file.file);
        if (digest(bytes) !== file.hash) throw fault('FILE_CHANGED', 'An upload changed after migration preflight');
        const context = contextForFile(root, file.file);
        const verified = decrypt(bytes, key, context);
        const original = contained(backup, file.relative);
        await safeDirectory(backup, file.relative.split('/').slice(0, -1).join('/'));
        try { await exclusiveFile(original, bytes); }
        catch (error) {
            if (error.code !== 'EEXIST') { verified.plaintext.fill(0); throw error; }
            if (!crypto.timingSafeEqual(Buffer.from(digest(await readRegular(original)), 'hex'), Buffer.from(file.hash, 'hex'))) {
                verified.plaintext.fill(0); throw fault('BACKUP_CONFLICT', 'An existing original-file backup differs; it will not be overwritten');
            }
        }
        const temporary = path.join(path.dirname(file.file), `.${path.basename(file.file)}.migration-${crypto.randomUUID()}`);
        try {
            await exclusiveFile(temporary, encrypt(verified.plaintext, key, context));
            if (digest(await readRegular(file.file)) !== file.hash) throw fault('FILE_CHANGED', 'An upload changed before atomic replacement');
            await fs.rename(temporary, file.file);
            summary.migrated++;
        } finally { verified.plaintext.fill(0); await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }
    return summary;
}

function argumentsFor(argv) {
    const options = {}; let dry = false;
    for (let index = 0; index < argv.length; index++) {
        if (argv[index] === '--apply') options.apply = true;
        else if (argv[index] === '--dry-run') dry = true;
        else if (argv[index] === '--uploads' && argv[index + 1]) options.uploads = argv[++index];
        else if (argv[index] === '--backup-dir' && argv[index + 1]) options.backupDirectory = argv[++index];
        else throw fault('ARGUMENTS', 'Use --dry-run or --apply, --uploads and --backup-dir');
    }
    if (dry && options.apply) throw fault('ARGUMENTS', 'Choose either dry-run or apply');
    return options;
}

if (require.main === module) Promise.resolve().then(() => migrateFileEncryption(argumentsFor(process.argv.slice(2)))).then(summary => {
    process.stdout.write(`${summary.dryRun ? 'Dry run' : 'Apply'}: scanned=${summary.scanned}, legacy=${summary.legacy}, up-to-date=${summary.upToDate}, migrated=${summary.migrated}\n`);
}).catch(error => {
    const code = /^[A-Z_]+$/.test(error.code || '') ? error.code : 'MIGRATION_FAILED';
    process.stderr.write(`Migration failed: ${error.safeMessage || 'Storage operation failed'} (${code})\n`);
    process.exitCode = 1;
});

module.exports = { migrateFileEncryption, contextForFile };
