const fs = require('node:fs/promises');
const { createReadStream, constants } = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const MAGIC = Buffer.from('SHMSBKP1');
const MAX_CHUNK = 1024 * 1024;
const MAX_FILES = 10000;
const MAX_MANIFEST = 8 * 1024 * 1024;
const fail = message => { throw new Error(message); };
const u32 = size => { const value = Buffer.alloc(4); value.writeUInt32BE(size); return value; };
const sha256 = () => crypto.createHash('sha256');

function encryptionKey(env) {
    const applicationKey = /^[a-f\d]{64}$/i.test(env.ENCRYPTION_KEY || '') ? Buffer.from(env.ENCRYPTION_KEY, 'hex') : null;
    const fingerprint = applicationKey ? sha256().update(applicationKey).digest('hex') : env.BACKUP_APPLICATION_KEY_SHA256;
    if (!/^[a-f\d]{64}$/i.test(env.BACKUP_ENCRYPTION_KEY || '') || !/^[a-f\d]{64}$/i.test(fingerprint || '')) {
        fail('BACKUP_ENCRYPTION_KEY and ENCRYPTION_KEY must be separately configured 32-byte hexadecimal keys');
    }
    const key = Buffer.from(env.BACKUP_ENCRYPTION_KEY, 'hex');
    if (crypto.timingSafeEqual(sha256().update(key).digest(), Buffer.from(fingerprint, 'hex'))) fail('The backup key must differ from the application encryption key');
    return key;
}

function uploadPath(relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.length > 600 || relative.startsWith('/') || relative.includes(':')) fail('Unsafe upload path');
    const parts = relative.split('/');
    if (parts.some(part => !/^[a-z\d][a-z\d._-]*$/i.test(part) || part === '.' || part === '..')) fail('Unsafe upload path');
    const document = parts.length === 2 && parts[0] === 'documents' && /\.(pdf|png|jpe?g)$/i.test(parts[1]);
    const medical = parts.length === 4 && parts[0] === 'medical_files' && /^[a-f\d-]{36}$/i.test(parts[1])
        && ['lab_results', 'imaging'].includes(parts[2]) && /\.(pdf|png|jpe?g|gif|bmp|tiff?|docx?|dcm|dicom|txt|xml|csv)$/i.test(parts[3]);
    if (!document && !medical) fail('Upload path is outside the encrypted clinical file allowlist');
    return relative;
}

function contained(root, relative) {
    const target = path.resolve(root, ...relative.split('/'));
    const relation = path.relative(path.resolve(root), target);
    if (!relation || relation.startsWith(`..${path.sep}`) || relation === '..' || path.isAbsolute(relation)) fail('Unsafe path outside the restore directory');
    return target;
}

function databaseConfig(env, restore = false) {
    const prefix = restore ? 'RESTORE_DB_' : 'DB_';
    const get = name => env[`${prefix}${name}`];
    const config = { host: get('HOST'), port: Number(get('PORT')), database: get('NAME'), user: get('USER'), password: get('PASSWORD') };
    if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 || !config.database || !config.user) fail(`Explicit ${prefix}HOST, PORT, NAME and USER settings are required`);
    if (restore && (env.RESTORE_DISPOSABLE !== 'true' || !['127.0.0.1', 'localhost', '::1'].includes(config.host)
        || !/^healthcare_restore_[a-z0-9_]+$/.test(config.database) || config.database.length > 63)) {
        fail('Restore requires RESTORE_DISPOSABLE=true, a loopback host and a new healthcare_restore_* database');
    }
    return config;
}

function toolEnvironment(env, config) {
    if (!['127.0.0.1','localhost','::1'].includes(config.host) && env.PGSSLMODE !== 'verify-full' && env.DB_SSL !== 'true') fail('Remote backups require verified TLS');
    if (env.DB_SSL === 'true' && env.PGSSLMODE && env.PGSSLMODE !== 'verify-full') fail('Database TLS must not be downgraded for backups');
    return Object.fromEntries(Object.entries({ PATH: env.PATH, SystemRoot: env.SystemRoot, TEMP: env.TEMP, TMP: env.TMP,
        PGHOST: config.host, PGPORT: String(config.port), PGDATABASE: config.database, PGUSER: config.user,
        PGPASSWORD: config.password, PGCONNECT_TIMEOUT: '10', PGSSLMODE: env.PGSSLMODE || (env.DB_SSL === 'true' ? 'verify-full' : 'disable'),
        PGSSLROOTCERT: env.PGSSLROOTCERT || env.DB_SSL_CA_FILE, LANG: 'C' }).filter(([, value]) => value !== undefined));
}

function tool(command, args, env) {
    const child = spawn(command, args, { env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    // Discard diagnostics: connection settings and clinical object names must not enter backup logs.
    child.stderr.resume();
    child.stdin.on('error', () => {});
    const timer = setTimeout(() => child.kill('SIGKILL'), 300000);
    const done = new Promise((resolve, reject) => {
        child.once('error', () => reject(new Error('PostgreSQL backup tool could not start')));
        child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`PostgreSQL backup tool failed (exit ${code})`)); });
    });
    done.catch(() => {});
    return { child, done };
}

async function append(handle, buffer) {
    for (let offset = 0; offset < buffer.length;) {
        const result = await handle.write(buffer, offset, buffer.length - offset);
        if (!result.bytesWritten) fail('Unable to write backup artifact');
        offset += result.bytesWritten;
    }
}

async function listUploads(root) {
    const metadata = await fs.lstat(root);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail('UPLOAD_PATH must be an existing real directory');
    const realRoot = await fs.realpath(root);
    const files = [];
    async function walk(directory, prefix = '') {
        for (const item of await fs.readdir(directory, { withFileTypes: true })) {
            const relative = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.isSymbolicLink()) fail('Symbolic links are forbidden in upload backups');
            if (item.isDirectory()) {
                if ((!prefix && !['medical_files', 'documents'].includes(item.name)) || item.name.startsWith('.')) fail('Unexpected directory in encrypted uploads');
                await walk(path.join(directory, item.name), relative);
            } else if (item.isFile()) {
                uploadPath(relative);
                files.push({ relative, absolute: contained(realRoot, relative) });
                if (files.length > MAX_FILES) fail('Backup exceeds the supported upload file count');
            } else fail('Only regular encrypted upload files are supported');
        }
    }
    await walk(realRoot);
    return { root: realRoot, files: files.sort((a, b) => a.relative.localeCompare(b.relative)) };
}

async function createBackup({ output, env = process.env, dumpCommand, databaseSnapshot } = {}) {
    const key = encryptionKey(env);
    const database = databaseConfig(env);
    if (!databaseSnapshot && env.BACKUP_QUIESCED !== 'true') fail('BACKUP_QUIESCED=true is required after stopping application writes');
    if (!env.UPLOAD_PATH || !output) fail('UPLOAD_PATH and an output artifact path are required');
    const uploads = await listUploads(path.resolve(env.UPLOAD_PATH));
    if (databaseSnapshot && (!/^[a-f\d-]+$/i.test(databaseSnapshot.id || '') || !['public','healthcare'].includes(databaseSnapshot.schema)
        || uploads.files.length || !Array.isArray(databaseSnapshot.extensions) || databaseSnapshot.extensions.some(e => !['uuid-ossp','pgcrypto','btree_gist'].includes(e.name) || !['public','extensions',databaseSnapshot.schema].includes(e.schema)))) fail('Invalid database-only snapshot descriptor');
    const destination = path.resolve(output);
    const outputRelation = path.relative(uploads.root, destination);
    if (!outputRelation || (!outputRelation.startsWith('..') && !path.isAbsolute(outputRelation))) fail('Backups must be stored outside UPLOAD_PATH');
    const partial = `${destination}.partial-${crypto.randomUUID()}`;
    let handle; let dump;
    try {
        handle = await fs.open(partial, 'wx', 0o600);
        const header = Buffer.concat([MAGIC, crypto.randomBytes(12)]);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, header.subarray(8));
        cipher.setAAD(header);
        await append(handle, header);
        const put = bytes => append(handle, cipher.update(bytes));
        const entries = [];
        async function entry(name, stream, encryptedUpload = false) {
            const headerBytes = Buffer.from(JSON.stringify({ path: name }));
            await put(u32(headerBytes.length)); await put(headerBytes);
            const hash = sha256(); let size = 0; let magic = Buffer.alloc(0);
            for await (const bytes of stream) {
                if (encryptedUpload && magic.length < 8) magic = Buffer.concat([magic, bytes]).subarray(0, 8);
                hash.update(bytes); size += bytes.length;
                for (let offset = 0; offset < bytes.length; offset += MAX_CHUNK) {
                    const chunk = bytes.subarray(offset, offset + MAX_CHUNK);
                    await put(u32(chunk.length)); await put(chunk);
                }
            }
            if (encryptedUpload && (size < 36 || magic.toString() !== 'SHMSENC2')) fail('Only identity-bound encrypted uploads may be backed up');
            await put(u32(0));
            return { path: name, size, sha256: hash.digest('hex') };
        }
        const snapshotArgs = databaseSnapshot ? [`--snapshot=${databaseSnapshot.id}`, `--schema=${databaseSnapshot.schema}`, ...databaseSnapshot.extensions.map(e=>`--extension=${e.name}`)] : [];
        dump = tool(dumpCommand?.file || env.PG_DUMP_BIN || 'pg_dump', [...(dumpCommand?.args || []), ...snapshotArgs, '--format=custom', '--no-owner', '--no-privileges', '--no-password'], toolEnvironment(env, database));
        dump.child.stdin.end();
        entries.push(await entry('database.dump', dump.child.stdout));
        await dump.done;
        for (const file of uploads.files) {
            const stat = await fs.lstat(file.absolute);
            if (!stat.isFile() || stat.isSymbolicLink()) fail('Upload changed during backup');
            entries.push(await entry(`uploads/${file.relative}`, createReadStream(file.absolute, { flags: constants.O_RDONLY | (constants.O_NOFOLLOW || 0) }), true));
        }
        const consistency = databaseSnapshot ? { mode:'database-only', schema:databaseSnapshot.schema, requiredSchemas:[...new Set(databaseSnapshot.extensions.map(e=>e.schema).filter(s=>s!==databaseSnapshot.schema))], tables:databaseSnapshot.tables } : {mode:'coordinated'};
        const manifest = Buffer.from(JSON.stringify({ version: 1, createdAt: databaseSnapshot?.createdAt || new Date().toISOString(), consistency, sourceDatabase: database.database,
            sourceUploadRoot: uploads.root.replaceAll('\\', '/'), entries }));
        if (manifest.length > MAX_MANIFEST) fail('Backup manifest exceeds the supported size');
        await entry('manifest.json', [manifest]);
        await put(u32(0));
        await append(handle, cipher.final()); await append(handle, cipher.getAuthTag());
        await handle.sync(); await handle.close(); handle = null;
        // Hard-link publication is atomic and never replaces an existing backup.
        await fs.link(partial, destination);
        return { output: destination, files: uploads.files.length, database: database.database };
    } finally {
        if (dump && dump.child.exitCode === null) dump.child.kill('SIGKILL');
        if (dump) await dump.done.catch(() => {});
        if (handle) await handle.close().catch(() => {});
        await fs.unlink(partial).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
}

class Reader {
    constructor(iterator) { this.iterator = iterator[Symbol.asyncIterator](); this.buffer = Buffer.alloc(0); }
    async read(size) {
        while (this.buffer.length < size) {
            const next = await this.iterator.next();
            if (next.done) fail('Backup bundle is truncated');
            this.buffer = Buffer.concat([this.buffer, next.value]);
        }
        const result = this.buffer.subarray(0, size); this.buffer = this.buffer.subarray(size); return result;
    }
    async number() { return (await this.read(4)).readUInt32BE(); }
    async close() { await this.iterator.return?.(); }
    async end() {
        if (this.buffer.length) fail('Unexpected trailing backup data');
        for (;;) { const next = await this.iterator.next(); if (next.done) return; if (next.value.length) fail('Unexpected trailing backup data'); }
    }
}

async function* decrypted(artifact, key) {
    const info = await fs.stat(artifact);
    if (info.size < 40) fail('Invalid backup envelope');
    const file = await fs.open(artifact, 'r');
    const header = Buffer.alloc(20); const tag = Buffer.alloc(16);
    try {
        await file.read(header, 0, 20, 0);
        if (!header.subarray(0, 8).equals(MAGIC)) fail('Unsupported backup envelope');
        await file.read(tag, 0, 16, info.size - 16);
    } finally { await file.close(); }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8));
    decipher.setAAD(header); decipher.setAuthTag(tag);
    for await (const bytes of createReadStream(artifact, { start: 20, end: info.size - 17 })) yield decipher.update(bytes);
    yield decipher.final();
}

async function inspectBundle(artifact, key, { onChunk, onEntryEnd } = {}) {
    const reader = new Reader(decrypted(artifact, key));
    try {
    const seen = new Set(); const entries = []; let manifest;
    for (;;) {
        const headerSize = await reader.number();
        if (!headerSize) break;
        if (headerSize > 16384 || manifest) fail('Invalid backup entry header');
        const header = JSON.parse((await reader.read(headerSize)).toString('utf8'));
        const name = header.path;
        if (typeof name !== 'string' || seen.has(name) || seen.size > MAX_FILES + 1) fail('Duplicate or excessive backup entries');
        if (name === 'database.dump') { if (seen.size) fail('Database dump must be the first entry'); }
        else if (name !== 'manifest.json') {
            if (!name.startsWith('uploads/')) fail('Unknown backup entry');
            uploadPath(name.slice(8));
        }
        seen.add(name);
        const hash = sha256(); let size = 0; let magic = Buffer.alloc(0); const manifestParts = [];
        for (;;) {
            const length = await reader.number();
            if (!length) break;
            if (length > MAX_CHUNK) fail('Backup chunk exceeds its size limit');
            const bytes = await reader.read(length);
            size += bytes.length; hash.update(bytes);
            if (magic.length < 8) magic = Buffer.concat([magic, bytes]).subarray(0, 8);
            if (name === 'manifest.json') { if (size > MAX_MANIFEST) fail('Backup manifest exceeds its size limit'); manifestParts.push(bytes); }
            else if (onChunk) await onChunk(name, bytes);
        }
        if (name.startsWith('uploads/') && (size < 36 || magic.toString() !== 'SHMSENC2')) fail('Unencrypted upload found in backup');
        if (name === 'manifest.json') manifest = JSON.parse(Buffer.concat(manifestParts).toString('utf8'));
        else entries.push({ path: name, size, sha256: hash.digest('hex') });
        if (onEntryEnd) await onEntryEnd(name);
    }
    await reader.end(); // Forces GCM final authentication before returning any usable manifest.
    if (!seen.has('database.dump') || !manifest || manifest.version !== 1 || typeof manifest.sourceUploadRoot !== 'string'
        || JSON.stringify(manifest.entries) !== JSON.stringify(entries)) fail('Backup manifest or file checksum verification failed');
    return manifest;
    } finally { await reader.close(); }
}

async function clientFor(config) {
    const { Client } = require('pg');
    const client = new Client({ ...config, ssl: false, connectionTimeoutMillis: 10000 });
    await client.connect(); return client;
}

const quoteIdentifier = value => `"${value.replaceAll('"', '""')}"`;
async function credentialTable(client, manifest) {
    // Do not depend on the drill administrator's search_path: hosted installs
    // keep application tables in healthcare, while local installs use public.
    const candidates = (await client.query(`SELECT n.nspname AS schema_name,c.relkind AS kind
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relname=$1 AND left(n.nspname,3)<>'pg_' AND n.nspname<>'information_schema'
        ORDER BY n.nspname LIMIT 3`, ['verification_documents'])).rows;
    if (candidates.length > 1) fail('Credential table schema is ambiguous; recovery cannot safely rebase references');
    if (!candidates.length) {
        if (manifest.entries.some(entry => entry.path.startsWith('uploads/documents/'))) fail('Credential uploads exist without a supported credential table');
        return null;
    }
    const candidate = candidates[0];
    if (!['public', 'healthcare'].includes(candidate.schema_name) || !['r', 'p'].includes(candidate.kind)) {
        fail('Credential table uses an unsupported application schema or relation type');
    }
    const qualified = `${quoteIdentifier(candidate.schema_name)}.${quoteIdentifier('verification_documents')}`;
    const columns = (await client.query(`SELECT a.attname FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname='verification_documents' AND a.attname IN('file_path','document_url') AND a.attnum>0 AND NOT a.attisdropped`, [candidate.schema_name])).rows;
    if (columns.length !== 1) fail('Credential file reference column is missing or ambiguous');
    return { qualified, column:quoteIdentifier(columns[0].attname) };
}

async function restoreBackup({ input, uploads: destinationPath, env = process.env, restoreCommand } = {}) {
    const key = encryptionKey(env);
    const database = databaseConfig(env, true);
    if (!input || !destinationPath) fail('An input artifact and a fresh restore upload directory are required');
    const destination = path.resolve(destinationPath);
    const parent = await fs.realpath(path.dirname(destination));
    if (path.join(parent, path.basename(destination)) !== destination) fail('Restore directory parent must not contain symbolic links');
    if (await fs.lstat(destination).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) fail('Restore upload directory must not already exist');
    const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'shms-recovery-'));
    await fs.chmod(staging, 0o700);
    const snapshot = path.join(staging, 'bundle.enc');
    let admin; let restored; let processRestore; let createdDatabase = false; let createdDirectory = false;
    try {
        await fs.copyFile(path.resolve(input), snapshot, constants.COPYFILE_EXCL);
        await fs.chmod(snapshot, 0o400);
        // Complete authentication and every checksum/path check precede database creation or file publication.
        const manifest = await inspectBundle(snapshot, key);
        admin = await clientFor({ ...database, database: env.RESTORE_ADMIN_DB || 'postgres' });
        if ((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database.database])).rows.length) fail('Restore requires a new disposable database; existing databases are never overwritten');
        await admin.query(`CREATE DATABASE "${database.database}" TEMPLATE template0`);
        createdDatabase = true;
        if (manifest.consistency?.mode === 'database-only') {
            const schemas = manifest.consistency.requiredSchemas;
            if (!['public','healthcare'].includes(manifest.consistency.schema) || !Array.isArray(schemas) || schemas.some(s=>!['public','extensions'].includes(s))) fail('Unsupported snapshot extension namespace');
            const provision = await clientFor(database);
            try { for (const schema of new Set(schemas)) await provision.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`); }
            finally { await provision.end(); }
        }
        await fs.mkdir(destination, { mode: 0o700 }); createdDirectory = true;
        processRestore = tool(restoreCommand?.file || env.PG_RESTORE_BIN || 'pg_restore', [...(restoreCommand?.args || []), '--single-transaction', '--exit-on-error', '--no-owner', '--no-privileges', '--no-password', '--dbname', database.database], toolEnvironment(env, database));
        processRestore.child.stdout.resume();
        const handles = new Map();
        try {
            await inspectBundle(snapshot, key, {
                onChunk: async (name, bytes) => {
                    if (name === 'database.dump') await new Promise((resolve, reject) => processRestore.child.stdin.write(bytes, error => error ? reject(error) : resolve()));
                    else {
                        let handle = handles.get(name);
                        if (!handle) {
                            const target = contained(destination, uploadPath(name.slice(8)));
                            await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
                            handle = await fs.open(target, 'wx', 0o600); handles.set(name, handle);
                        }
                        await append(handle, bytes);
                    }
                },
                onEntryEnd: async name => { if (handles.has(name)) { await handles.get(name).close(); handles.delete(name); } },
            });
        } finally { for (const handle of handles.values()) await handle.close().catch(() => {}); }
        processRestore.child.stdin.end();
        await processRestore.done;
        restored = await clientFor(database);
        await restored.query('BEGIN');
        const credentials = await credentialTable(restored, manifest);
        if (credentials) {
            const documents = await restored.query(`SELECT id,${credentials.column} AS file_path FROM ${credentials.qualified}`);
            const original = manifest.sourceUploadRoot.replaceAll('\\', '/').replace(/\/$/, '');
            for (const document of documents.rows) {
                const file = String(document.file_path || '').replaceAll('\\', '/');
                if (!file.startsWith(`${original}/`)) fail('Credential reference is outside the backed-up upload root');
                const relative = uploadPath(file.slice(original.length + 1));
                if (!manifest.entries.some(entry => entry.path === `uploads/${relative}`)) fail('Credential document is missing from the backup');
                await restored.query(`UPDATE ${credentials.qualified} SET ${credentials.column}=$1 WHERE id=$2`, [contained(destination, relative), document.id]);
            }
        }
        await restored.query('COMMIT');
        return { database: database.database, uploads: destination, files: manifest.entries.length - 1 };
    } catch (error) {
        if (processRestore && processRestore.child.exitCode === null) { processRestore.child.kill('SIGKILL'); await processRestore.done.catch(() => {}); }
        if (restored) { await restored.end().catch(() => {}); restored = null; }
        if (createdDatabase && admin) await admin.query(`DROP DATABASE "${database.database}"`).catch(() => { error.message += '; disposable database cleanup failed'; });
        if (createdDirectory) {
            const actual = await fs.realpath(destination).catch(() => null);
            if (actual === destination && path.dirname(actual) === parent) await fs.rm(actual, { recursive: true, force: true });
        }
        throw error;
    } finally {
        if (restored) await restored.end().catch(() => {});
        if (admin) await admin.end().catch(() => {});
        if (path.dirname(staging) === path.resolve(os.tmpdir()) && path.basename(staging).startsWith('shms-recovery-')) await fs.rm(staging, { recursive: true, force: true });
    }
}

module.exports = { createBackup, restoreBackup, inspectBundle, encryptionKey, uploadPath, contained };
