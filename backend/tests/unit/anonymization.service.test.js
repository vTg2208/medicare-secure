const crypto = require('node:crypto');
const config = { security: { encryptionKey: 'ab'.repeat(32) } };
const configPath = require.resolve('../../src/config/env');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: config };
delete require.cache[require.resolve('../../src/services/anonymization.service')];
const service = require('../../src/services/anonymization.service');
const patient = '11111111-1111-4111-8111-111111111111';
const scope = 'research:22222222-2222-4222-8222-222222222222';

afterEach(() => { config.security.encryptionKey = 'ab'.repeat(32); vi.unstubAllEnvs(); });

it('uses stable keyed pseudonyms separated by researcher scope and application key', () => {
    const token = service.generatePseudonym(patient, scope);
    expect(token).toMatch(/^psn_v1_[a-f\d]{64}$/);
    expect(service.generatePseudonym(patient, scope)).toBe(token);
    expect(service.generatePseudonym(patient, `${scope}:another`)).not.toBe(token);
    expect(service.generatePseudonym('33333333-3333-4333-8333-333333333333', scope)).not.toBe(token);
    config.security.encryptionKey = 'cd'.repeat(32);
    expect(service.generatePseudonym(patient, scope)).not.toBe(token);
    expect(token).not.toContain(patient);
});

it('fails closed for missing keys, participant identity and explicit research scope', () => {
    expect(() => service.generatePseudonym(patient)).toThrow();
    expect(() => service.generatePseudonym('', scope)).toThrow();
    config.security.encryptionKey = '';
    expect(() => service.generatePseudonym(patient, scope)).toThrow();
});

it('projects only approved generalized fields, dropping nested and newly introduced identifiers', () => {
    const input = { id: patient, patient_id: patient, user_id: patient, email: 'private@example.invalid',
        firstName: 'Private', passport: 'private', date_of_birth: '1991-01-01', gender: 'female',
        notes: 'private medical narrative', diagnosis: 'private', nested: { address: 'private' }, created_at: '2020-01-01' };
    const result = service.anonymizePatientData(input, scope);
    expect(Object.keys(result).sort()).toEqual(['age_range', 'gender', 'pseudonym_id', 'registration_year']);
    expect(result).toMatchObject({ gender: 'female', registration_year: '2020' });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(input.email).toBe('private@example.invalid');
});

it('suppresses quasi-identifier groups below k distinct participants, including duplicate rows', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`, gender: 'female' }));
    expect(service.anonymizeDataset(rows, scope, 5)).toHaveLength(5);
    expect(service.anonymizeDataset(rows.slice(0, 4), scope, 5)).toEqual([]);
    expect(service.anonymizeDataset(Array(5).fill(rows[0]), scope, 5)).toEqual([]);
    expect(service.anonymizeDataset([...rows, { id: patient, gender: 'male' }], scope, 5)).toHaveLength(5);
    expect(() => service.anonymizeDataset(rows, scope, 1)).toThrow();
});

it('shares a domain-separated HMAC key with database research processing', () => {
    const key = service.derivePseudonymKey(scope);
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.equals(Buffer.from(config.security.encryptionKey, 'hex'))).toBe(false);
    expect(service.generatePseudonym(patient, scope)).toBe(`psn_v1_${crypto.createHmac('sha256', key).update(patient).digest('hex')}`);
});

it('supports keyring-only deployments and derives tokens from the selected active key', () => {
    config.security.encryptionKey = undefined;
    vi.stubEnv('APPLICATION_ENCRYPTION_KEYS', JSON.stringify({ current: 'ef'.repeat(32), previous: 'cd'.repeat(32) }));
    vi.stubEnv('ENCRYPTION_ACTIVE_KEY_ID', 'current');
    const current = service.generatePseudonym(patient, scope);
    expect(current).toMatch(/^psn_v1_[a-f\d]{64}$/);
    vi.stubEnv('ENCRYPTION_ACTIVE_KEY_ID', 'previous');
    expect(service.generatePseudonym(patient, scope)).not.toBe(current);
    vi.stubEnv('ENCRYPTION_ACTIVE_KEY_ID', 'missing');
    expect(() => service.generatePseudonym(patient, scope)).toThrow();
});
