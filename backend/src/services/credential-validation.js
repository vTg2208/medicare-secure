const path = require('node:path');

const MIME_BY_EXTENSION = Object.freeze({
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
});
const invalidDocument = () => Object.assign(new Error('Invalid credential document. Only matching PDF, JPEG and PNG files are allowed.'), { statusCode: 400 });

function validateCredentialMetadata(filename, mimetype) {
    if (typeof filename !== 'string' || !filename || filename !== filename.trim() || /[\x00-\x1f\x7f]/.test(filename)) throw invalidDocument();
    const expected = MIME_BY_EXTENSION[path.extname(filename).toLowerCase()];
    if (!expected || expected !== mimetype) throw invalidDocument();
    return expected;
}

function detectedMime(bytes) {
    // Require complete identifying headers, not the permissive four-byte
    // prefixes used by the general clinical scanner. This is type detection;
    // the antivirus scan remains mandatory after validation.
    if (bytes.length >= 9 && /^%PDF-(?:1\.[0-7]|2\.0)[\t\r\n ]/.test(bytes.subarray(0, 9).toString('latin1'))) return 'application/pdf';
    if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        && bytes.readUInt32BE(8) === 13 && bytes.subarray(12, 16).toString('ascii') === 'IHDR') return 'image/png';
    if (bytes.length >= 6 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        && bytes[3] >= 0xc0 && bytes[3] <= 0xfe && !(bytes[3] >= 0xd0 && bytes[3] <= 0xd9)) {
        const segmentLength = bytes.readUInt16BE(4);
        if (segmentLength >= 2 && segmentLength + 4 <= bytes.length) return 'image/jpeg';
    }
    return null;
}

function validateCredentialDocument(filename, mimetype, bytes) {
    const expected = validateCredentialMetadata(filename, mimetype);
    if (!Buffer.isBuffer(bytes) || detectedMime(bytes) !== expected) throw invalidDocument();
}

module.exports = { validateCredentialMetadata, validateCredentialDocument };
