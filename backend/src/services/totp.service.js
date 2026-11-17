const crypto = require('crypto');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30000;

const generateSecret = () => {
    const bytes = crypto.randomBytes(20);
    let bits = 0, value = 0, result = '';
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) { bits -= 5; result += ALPHABET[(value >>> bits) & 31]; }
    }
    return result;
};

const decodeSecret = secret => {
    if (typeof secret !== 'string' || !/^[A-Z2-7]{32,128}$/.test(secret)) throw new Error('Invalid authenticator secret');
    let bits = 0, value = 0;
    const bytes = [];
    for (const character of secret) {
        value = (value << 5) | ALPHABET.indexOf(character);
        bits += 5;
        if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
    }
    if (bits && (value & ((1 << bits) - 1))) throw new Error('Invalid authenticator secret');
    return Buffer.from(bytes);
};

const generateTotp = (secret, time = Date.now(), { digits = 6 } = {}) => {
    if (![6, 8].includes(digits) || !Number.isSafeInteger(time) || time < 0) throw new Error('Invalid authenticator parameters');
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(time / STEP_MS)));
    const digest = crypto.createHmac('sha1', decodeSecret(secret)).update(counter).digest();
    const offset = digest[digest.length - 1] & 15;
    return ((digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).toString().padStart(digits, '0');
};

// Return the accepted counter so the caller can atomically persist replay protection.
const verifyTotp = (secret, code, { now = Date.now(), lastStep = -1 } = {}) => {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code) || !Number.isSafeInteger(now) || now < 0) return null;
    const current = Math.floor(now / STEP_MS);
    let accepted = null;
    for (const step of [current - 1, current, current + 1]) {
        if (step < 0) continue;
        const expected = generateTotp(secret, step * STEP_MS);
        const matches = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code));
        if (matches && step > Number(lastStep)) accepted = step;
    }
    return accepted;
};

const provisioningUri = (secret, account) => {
    decodeSecret(secret);
    if (typeof account !== 'string' || !account || account.length > 254) throw new Error('Invalid authenticator account');
    const query = new URLSearchParams({ secret, issuer: 'Medicare', algorithm: 'SHA1', digits: '6', period: '30' });
    return `otpauth://totp/${encodeURIComponent(`Medicare:${account}`)}?${query}`;
};

module.exports = { generateSecret, generateTotp, verifyTotp, provisioningUri };
