const fs = require('fs/promises');
const { transaction } = require('../../config/db');
const { createUser, userExists } = require('../../models/user.model');
const { createDoctorProfile } = require('../../models/doctor.model');
const VerificationDocument = require('../../models/verification_document.model');
const { getRoleByName } = require('../../models/role.model');
const { isValidEmail, validatePassword } = require('../../utils/validators');
const { secureCredential } = require('../../services/credential-file.service');
const { logAuditEvent } = require('../../services/audit.service');
const { sendDoctorRegistrationNotification } = require('../../config/mail');
const logger = require('../../utils/logger');

module.exports = async (req, res) => {
    const files = [req.files?.degreeCertificate?.[0], req.files?.medicalRegCertificate?.[0]].filter(Boolean);
    let committed = false;
    try {
        const { email, phone, password, firstName, lastName, licenseNumber, specialization } = req.body;
        if (!isValidEmail(email) || !validatePassword(password).isValid || typeof licenseNumber !== 'string' || !licenseNumber.trim() || files.length !== 2) {
            return res.status(400).json({ success: false, message: 'A valid email, strong password, medical registration number, degree certificate, and registration certificate are required' });
        }
        if (await userExists(email, phone)) return res.status(409).json({ success: false, message: 'An account with these details already exists' });
        for (const file of files) await secureCredential(file);
        const role = await getRoleByName('doctor');
        const user = await transaction(async client => {
            const created = await createUser({ email, phone, password, roleId: role.id, firstName, lastName,
                isVerified: false, status: 'pending', verificationStatus: 'pending', accountStatus: 'pending_verification' }, client);
            await createDoctorProfile({ userId: created.id, specialization: specialization || 'General Medicine', licenseNumber,
                experienceYears: Number(req.body.experienceYears) || 0, regYear: Number(req.body.regYear) || null,
                stateMedicalCouncil: req.body.stateMedicalCouncil || null }, client);
            for (const [index, file] of files.entries()) await VerificationDocument.create({ userId: created.id,
                documentType: index === 0 ? 'degree_certificate' : 'medical_license', filePath: file.path,
                fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype }, client);
            await logAuditEvent({ userId: created.id, action: 'user_register', entityType: 'user', entityId: created.id,
                purpose: 'Doctor credential submission', ipAddress: req.ip, statusCode: 201 }, client);
            return created;
        });
        committed = true;
        req.auditEventRecorded = true;
        if (process.env.ADMIN_EMAIL || process.env.EMAIL_USER) sendDoctorRegistrationNotification({ email, firstName, lastName, registrationId: licenseNumber })
            .catch(() => logger.error('Doctor registration notification delivery failed'));
        return res.status(201).json({ success: true, message: 'Credentials submitted for administrator review. You can sign in after approval.', data: { userId: user.id, status: 'pending' } });
    } catch (error) {
        logger.error('Doctor registration failed', { code: error.code });
        return res.status(error.code === '23505' ? 409 : error.statusCode || 500).json({ success: false,
            message: error.statusCode ? error.message : 'Doctor registration could not be completed' });
    } finally {
        if (!committed) for (const file of files) await fs.unlink(file.path).catch(() => {});
    }
};
