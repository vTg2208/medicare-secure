const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');
const crypto = require('crypto');
const { secureCredential } = require('../services/credential-file.service');

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
            try {
                if (file.stream.truncated) return cb(Object.assign(new Error('Credential file exceeds the size limit'), { statusCode: 400 }));
                await secureCredential({ path: filePath, originalname: file.originalname, mimetype: file.mimetype, buffer: Buffer.concat(chunks) });
                cb(null, { destination: uploadDir, filename, path: filePath, size });
            } catch (error) {
                await fs.promises.unlink(filePath).catch(() => {});
                cb(error);
            }
        });
    },
    _removeFile(req, file, cb) {
        fs.unlink(file.path, cb);
    },
};

const fileFilter = (req, file, cb) => {
    // Accept images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const err = new Error('Invalid file type. Only JPEG, PNG and PDF are allowed.');
        err.statusCode = 400;
        cb(err, false);
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
