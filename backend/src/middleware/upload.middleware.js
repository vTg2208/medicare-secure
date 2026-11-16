const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');
const crypto = require('crypto');
const { secureCredential } = require('../services/credential-file.service');
const encryptedStorage = require('../services/encrypted-file-store');
const { validateCredentialMetadata, validateCredentialDocument } = require('../services/credential-validation');

// Ensure upload directories exist
const uploadDir = path.resolve(config.upload.uploadPath, 'documents');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer enforces its size limit while we collect bytes. Only scanned,
// encrypted bytes are ever written to the persistent credential directory.
const storage = {
    _handleFile(req, file, cb) {
        const chunks = [];
        let size = 0;
        file.stream.on('data', chunk => { chunks.push(chunk); size += chunk.length; });
        file.stream.once('error', cb);
        file.stream.once('end', async () => {
            const filename = `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`;
            const filePath = path.join(uploadDir, filename);
            let validated = false;
            let durable = false;
            try {
                if (file.stream.truncated) return cb(Object.assign(new Error('Credential file exceeds the size limit'), { statusCode: 400 }));
                const buffer = Buffer.concat(chunks);
                validateCredentialDocument(file.originalname, file.mimetype, buffer);
                validated = true;
                durable = encryptedStorage.isPostgresStorage();
                const prepared = await secureCredential({ path: filePath, originalname: file.originalname, mimetype: file.mimetype, buffer }, { persist: !durable });
                // An incomplete/aborted multipart request cannot permanently
                // allocate durable objects before its controller validates it.
                cb(null, { destination: uploadDir, filename, path: filePath, size, ...(durable && { buffer: prepared }) });
            } catch (error) {
                if (validated && !durable) await encryptedStorage.removeEncrypted(filePath).catch(() => {});
                cb(error);
            }
        });
    },
    _removeFile(req, file, cb) {
        encryptedStorage.removeEncrypted(file.path).then(() => cb(null), cb);
    },
};

const fileFilter = (req, file, cb) => {
    try {
        validateCredentialMetadata(file.originalname, file.mimetype);
        cb(null, true);
    } catch (error) {
        cb(error, false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 2,
        fields: 40,
        parts: 42,
    },
    fileFilter: fileFilter
});

module.exports = upload;
