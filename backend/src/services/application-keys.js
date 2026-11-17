const crypto = require('crypto');
const invalid = () => new Error('Invalid application encryption key configuration');
const validHex = value => typeof value === 'string' && /^[a-f\d]{64}$/i.test(value) && !/^0{64}$/.test(value);

const getApplicationKeys = (env = process.env) => {
    const entries = new Map();
    if (env.APPLICATION_ENCRYPTION_KEYS !== undefined) {
        const raw = env.APPLICATION_ENCRYPTION_KEYS;
        if (typeof raw !== 'string' || raw.length > 4096) throw invalid();
        let parsed;
        try { parsed = JSON.parse(raw); } catch { throw invalid(); }
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw invalid();
        // JSON.parse otherwise silently accepts duplicate property names.
        const declared = [...raw.matchAll(/("(?:[^"\\]|\\.)*")\s*:/g)].map(match => JSON.parse(match[1]));
        if (new Set(declared).size !== declared.length) throw invalid();
        for (const [id, hex] of Object.entries(parsed)) {
            if (!/^[a-z][a-z0-9_-]{0,31}$/.test(id) || !validHex(hex)) throw invalid();
            entries.set(id, Buffer.from(hex, 'hex'));
        }
        if (!entries.size || !env.ENCRYPTION_ACTIVE_KEY_ID) throw invalid();
    }
    if (env.ENCRYPTION_KEY !== undefined) {
        if (!validHex(env.ENCRYPTION_KEY)) throw invalid();
        const legacy = Buffer.from(env.ENCRYPTION_KEY, 'hex');
        if (entries.has('legacy') && !entries.get('legacy').equals(legacy)) throw invalid();
        entries.set('legacy', legacy);
    }
    const activeId = env.ENCRYPTION_ACTIVE_KEY_ID || 'legacy';
    if (!entries.size || entries.size > 5 || !entries.has(activeId)) throw invalid();
    const fingerprints = [...entries.values()].map(key => key.toString('hex'));
    if (new Set(fingerprints).size !== fingerprints.length) throw invalid();
    if (env.BACKUP_ENCRYPTION_KEY !== undefined) {
        if (!validHex(env.BACKUP_ENCRYPTION_KEY)) throw invalid();
        const backupKey = Buffer.from(env.BACKUP_ENCRYPTION_KEY, 'hex');
        if ([...entries.values()].some(key => crypto.timingSafeEqual(key, backupKey))) throw invalid();
    }
    const keys = [...entries].map(([id, key]) => ({ id, key }));
    keys.sort((left, right) => left.id === activeId ? -1 : right.id === activeId ? 1 : left.id.localeCompare(right.id));
    return { activeId, activeKey: entries.get(activeId), keys };
};

module.exports = { getApplicationKeys };
