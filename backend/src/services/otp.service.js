const { timingSafeEqual } = require('crypto');
const { query, transaction } = require('../config/db');
const { generateOTP } = require('../utils/idGenerator');
const { hashOTP } = require('./encryption.service');
const { sendOTPEmail } = require('../config/mail');
const config = require('../config/env');
const { OTP_PURPOSE } = require('../utils/constants');

const generateAndSendOTP = async ({ email, userId, purpose }) => {
    if (!email) throw new Error('An email address is required for verification; SMS delivery is not configured');
    if (!Object.values(OTP_PURPOSE).includes(purpose)) throw new Error('Invalid OTP purpose');
    if (!userId) {
        const user = await query('SELECT id FROM users WHERE email = $1', [email]);
        userId = user.rows[0]?.id;
        if (!userId) return { success: true, message: 'If the account exists, a verification email has been sent' };
    }
    const otp = generateOTP(config.otp.length);
    const result = await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`otp:${email}`]);
        const count = await client.query(`SELECT COUNT(*) AS count FROM otp_verifications
            WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`, [email]);
        if (Number(count.rows[0].count) >= config.otp.maxAttempts) throw new Error('Too many OTP requests. Please try again later');
        await client.query('UPDATE otp_verifications SET expires_at = NOW() WHERE email = $1 AND purpose = $2 AND is_verified = false', [email, purpose]);
        const inserted = await client.query(`INSERT INTO otp_verifications (user_id, email, otp_hash, purpose, expires_at)
            VALUES ($1, $2, $3, $4, NOW() + $5 * INTERVAL '1 minute') RETURNING id, expires_at`,
        [userId, email, hashOTP(otp), purpose, config.otp.expiryMinutes]);
        return inserted.rows[0];
    });
    try {
        await sendOTPEmail(email, otp, purpose);
    } catch (error) {
        await query('UPDATE otp_verifications SET expires_at = NOW() WHERE id = $1', [result.id]);
        throw new Error('Verification email could not be delivered. Please retry later');
    }
    return { success: true, message: 'Verification email sent', otpId: result.id, expiresAt: result.expires_at };
};

const verifyOTP = async ({ email, phone, otp, purpose }) => {
    if (!email && !phone) throw new Error('Either email or phone is required');
    if (typeof otp !== 'string' || !new RegExp(`^\\d{${config.otp.length}}$`).test(otp)) throw new Error('Invalid OTP code');
    if (!Object.values(OTP_PURPOSE).includes(purpose)) throw new Error('Invalid OTP purpose');
    // Return failures from the transaction so failed-attempt increments are committed.
    const outcome = await transaction(async client => {
        const result = await client.query(`SELECT id, user_id, otp_hash, attempts, expires_at FROM otp_verifications
            WHERE ${email ? 'email' : 'phone'} = $1 AND purpose = $2 AND is_verified = false
            ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, [email || phone, purpose]);
        const record = result.rows[0];
        if (!record) return { error: 'Invalid OTP code' };
        if (new Date(record.expires_at).getTime() <= Date.now()) return { error: 'OTP has expired' };
        if (record.attempts >= config.otp.maxAttempts) return { error: 'Maximum OTP verification attempts exceeded' };
        const expected = Buffer.from(record.otp_hash, 'hex');
        const supplied = Buffer.from(hashOTP(otp), 'hex');
        if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
            await client.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
            return { error: 'Invalid OTP code' };
        }
        await client.query('UPDATE otp_verifications SET is_verified = true WHERE id = $1', [record.id]);
        return { success: true, message: 'OTP verified successfully', userId: record.user_id };
    });
    if (outcome.error) throw new Error(outcome.error);
    return outcome;
};

const cleanupExpiredOTPs = async () => {
    const result = await query("DELETE FROM otp_verifications WHERE expires_at < NOW() - INTERVAL '24 hours'");
    return result.rowCount;
};
module.exports = { generateAndSendOTP, verifyOTP, cleanupExpiredOTPs };
