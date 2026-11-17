// Explicit custody-side check only. Normal archive workers never need these keys.
const crypto = require('node:crypto');
const { getApplicationKeys } = require('../src/services/application-keys');
const { decryptSecret } = require('../src/services/encryption.service');
const { decryptBuffer } = require('../src/services/file.crypto');

function verifyRecoverySamples(samples, env) {
    getApplicationKeys(env);
    const counts = { mfa: 0, privacy: 0, uploads: 0 };
    let total = 0;
    for (const category of Object.keys(counts)) {
        const entries = samples[category] || [];
        if (!Array.isArray(entries) || (total += entries.length) > 64) throw new Error('Recovery sample limit exceeded');
        for (const sample of entries) {
            if (typeof sample.context !== 'string' || !sample.context || sample.context.length > 1024
                || !/^[a-f0-9]{64}$/.test(sample.sha256 || '')) throw new Error('Invalid recovery sample');
            let plaintext;
            try {
                if (category === 'mfa') plaintext = Buffer.from(decryptSecret(sample.envelope, sample.context, env));
                else {
                    if (typeof sample.ciphertext !== 'string' || sample.ciphertext.length > 16 * 1024 * 1024) throw new Error('Invalid ciphertext');
                    plaintext = decryptBuffer(Buffer.from(sample.ciphertext, 'base64'), sample.context, env);
                }
                const actual = crypto.createHash('sha256').update(plaintext).digest();
                if (!crypto.timingSafeEqual(actual, Buffer.from(sample.sha256, 'hex'))) throw new Error('Unexpected recovered content');
                counts[category]++;
            } catch { throw new Error('Recovery encryption verification failed'); }
            finally { plaintext?.fill(0); }
        }
    }
    if (!total) throw new Error('At least one recovery sample is required');
    return counts;
}
module.exports = { verifyRecoverySamples };
