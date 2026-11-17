let keys = {};
try { keys = require('../../src/services/application-keys'); }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const oldKey = '11'.repeat(32);
const newKey = '22'.repeat(32);
const env = { ENCRYPTION_KEY: oldKey, APPLICATION_ENCRYPTION_KEYS: JSON.stringify({ current: newKey }), ENCRYPTION_ACTIVE_KEY_ID: 'current' };

describe('bounded application key configuration', () => {
    test('retains legacy decryption while selecting an explicit active key', () => {
        expect(keys.getApplicationKeys).toBeTypeOf('function');
        const ring = keys.getApplicationKeys(env);
        expect(ring.activeId).toBe('current');
        expect(ring.activeKey.equals(Buffer.from(newKey, 'hex'))).toBe(true);
        expect(ring.keys.map(entry => entry.id)).toEqual(['current', 'legacy']);
    });
    test('rejects invalid, duplicate, unbounded and missing-active configuration without exposing keys', () => {
        expect(keys.getApplicationKeys).toBeTypeOf('function');
        const invalid = [
            {}, { ENCRYPTION_KEY: 'bad' }, { ...env, ENCRYPTION_ACTIVE_KEY_ID: 'absent' },
            { ...env, APPLICATION_ENCRYPTION_KEYS: '{' },
            { ...env, APPLICATION_ENCRYPTION_KEYS: JSON.stringify({ current: newKey, duplicate: newKey }) },
            { ...env, APPLICATION_ENCRYPTION_KEYS: '{"current":"'+newKey+'","current":"'+oldKey+'"}' },
            { ...env, APPLICATION_ENCRYPTION_KEYS: JSON.stringify(Object.fromEntries(Array.from({ length: 6 }, (_, i) => ['k'+i, (i+3).toString(16).padStart(2,'0').repeat(32)]))) },
        ];
        for (const config of invalid) {
            expect(() => keys.getApplicationKeys(config)).toThrow();
            try { keys.getApplicationKeys(config); } catch (error) {
                expect(error.message).not.toContain(oldKey);
                expect(error.message).not.toContain(newKey);
            }
        }
    });
    test('preserves single-key deployments and forbids backup-key reuse across the ring', () => {
        expect(keys.getApplicationKeys).toBeTypeOf('function');
        expect(keys.getApplicationKeys({ ENCRYPTION_KEY: oldKey }).activeId).toBe('legacy');
        expect(() => keys.getApplicationKeys({ ...env, BACKUP_ENCRYPTION_KEY: oldKey })).toThrow();
        expect(() => keys.getApplicationKeys({ ...env, BACKUP_ENCRYPTION_KEY: newKey })).toThrow();
    });
});
