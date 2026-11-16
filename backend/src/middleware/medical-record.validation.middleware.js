// Keep the public record contract aligned with ordered/006_application_features.sql.
const RECORD_TYPES = new Set([
    'consultation', 'diagnosis', 'treatment', 'prescription', 'lab_result',
    'imaging', 'procedure', 'vaccination', 'note', 'other',
]);
const FIELDS = new Set(['patientId', 'visitId', 'type', 'title', 'description']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = value => typeof value === 'string' && UUID.test(value);
// The title limit matches VARCHAR(255) and the existing form. TEXT has no
// database bound, so allow substantial clinical notes within the 1 MB JSON cap.
const TITLE_LIMIT = 255;
const DESCRIPTION_LIMIT = 100000;

const validateMedicalRecord = (req, res, next) => {
    const body = req.body;
    const reject = message => res.status(400).json({ success: false, message });
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(body))) {
        return reject('Medical record must be a JSON object');
    }
    if (Object.keys(body).some(field => !FIELDS.has(field))) {
        return reject('Medical record contains unsupported fields');
    }
    if (!validId(body.patientId)) return reject('A valid patientId UUID is required');
    if (body.visitId !== undefined && body.visitId !== null && !validId(body.visitId)) {
        return reject('visitId must be a UUID or null');
    }
    if (typeof body.type !== 'string' || !RECORD_TYPES.has(body.type)) {
        return reject('A supported medical record type is required');
    }
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > TITLE_LIMIT || body.title.includes('\0')) {
        return reject(`title must be nonblank text of at most ${TITLE_LIMIT} characters without NUL characters`);
    }
    if (body.description !== undefined && body.description !== null &&
        (typeof body.description !== 'string' || body.description.length > DESCRIPTION_LIMIT || body.description.includes('\0'))) {
        return reject(`description must be text of at most ${DESCRIPTION_LIMIT} characters without NUL characters, or null`);
    }
    // Validate without rewriting clinical prose, whitespace, or line breaks.
    return next();
};

module.exports = { validateMedicalRecord };
