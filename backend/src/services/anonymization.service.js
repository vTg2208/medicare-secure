const crypto = require('node:crypto');
const config = require('../config/env');
const { getApplicationKeys } = require('./application-keys');
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

// Pseudonymization is not anonymization. Keys are separated from file encryption
// and other researchers. No identity mapping, key or participant is logged.
const derivePseudonymKey = scope => {
    if (typeof scope !== 'string' || !scope.trim() || scope.length > 200) throw new Error('An explicit research scope is required');
    const { activeKey } = getApplicationKeys({ ...process.env, ENCRYPTION_KEY: config.security.encryptionKey });
    return Buffer.from(crypto.hkdfSync('sha256', activeKey,
        Buffer.from('medicare-pseudonymization-v1'), Buffer.from(scope), 32));
};
const generatePseudonym = (patientId, scope) => {
    if (!UUID.test(patientId || '')) throw new Error('A valid participant identity is required');
    return `psn_v1_${crypto.createHmac('sha256', derivePseudonymKey(scope)).update(patientId.toLowerCase()).digest('hex')}`;
};
const generalizeAge = age => {
    if (!Number.isFinite(age) || age < 0 || age > 130) return 'Unknown';
    if (age < 18) return '0-17';
    if (age < 30) return '18-29';
    if (age < 40) return '30-39';
    if (age < 50) return '40-49';
    if (age < 60) return '50-59';
    if (age < 70) return '60-69';
    return '70+';
};
const generalizeDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : String(date.getUTCFullYear());
};

// Legacy function names retained. An allowlist excludes nested, camelCase and
// unknown identity/clinical fields instead of attempting to enumerate every PII.
const anonymizePatientData = (patient, scope) => {
    const birth = new Date(patient.date_of_birth);
    const now = new Date();
    const birthdayPending = now.getUTCMonth() < birth.getUTCMonth() ||
        (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
    const age = patient.date_of_birth ? now.getUTCFullYear() - birth.getUTCFullYear() - Number(birthdayPending) : NaN;
    const result = { pseudonym_id: generatePseudonym(patient.user_id || patient.id, scope), age_range: generalizeAge(age),
        gender: ['male', 'female', 'other'].includes(patient.gender) ? patient.gender : 'Unknown' };
    const year = generalizeDate(patient.created_at);
    if (year) result.registration_year = year;
    return result;
};
const anonymizeDataset = (dataset, scope, kValue = 5) => {
    if (!Number.isSafeInteger(kValue) || kValue < 5) throw new Error('The minimum distinct-participant group size is five');
    if (!Array.isArray(dataset)) throw new Error('A participant dataset is required');
    const projected = dataset.map(row => anonymizePatientData(row, scope));
    const groupKey = row => JSON.stringify([row.age_range, row.gender, row.registration_year || null]);
    const groups = new Map();
    for (const row of projected) {
        const key = groupKey(row);
        if (!groups.has(key)) groups.set(key, new Set());
        groups.get(key).add(row.pseudonym_id);
    }
    return projected.filter(row => groups.get(groupKey(row)).size >= kValue);
};

module.exports = { derivePseudonymKey, generatePseudonym, anonymizePatientData, anonymizeDataset, generalizeAge, generalizeDate };
