const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const MalwareScannerService = require('./malware.scanner.service');
const { encryptBuffer, decryptBuffer } = require('./file.crypto');
const config = require('../config/env');

class FileUploadService {
    /**
     * Process and save uploaded file
     * @param {Object} file - Multer file object
     * @param {Object} options - Upload options
     * @returns {Promise<Object>} File info
     */
    static async processUpload(file, options = {}) {
        const {
            patientId,
            recordId,
            fileType = 'medical',
            scanForMalware = true
        } = options;

        // Read file buffer
        const fileBuffer = file.buffer || await fs.readFile(file.path);
        await require('./antivirus.service').scanBuffer(fileBuffer);

        // Scan for malware if enabled
        if (scanForMalware) {
            const scanResults = await MalwareScannerService.scanFile(file.originalname, fileBuffer);

            if (!scanResults.safe) {
                // Quarantine suspicious file
                if (file.path) await fs.unlink(file.path).catch(() => {});

                throw new Error(`File failed security scan: ${scanResults.threats.join(', ')}`);
            }
        }

        // Generate secure filename
        const secureFileName = this.generateSecureFileName(file.originalname);

        // Determine storage path
        const storagePath = this.getStoragePath(patientId, fileType);

        // Create directory if it doesn't exist
        await fs.mkdir(storagePath, { recursive: true });

        // Final file path
        const finalPath = path.join(storagePath, secureFileName);

        // Move file to final location
        await fs.writeFile(finalPath, encryptBuffer(fileBuffer, this.encryptionContext(finalPath)), { mode: 0o600, flag: 'wx' });
        if (file.path) await fs.unlink(file.path);

        // Calculate file hash for integrity
        const fileHash = MalwareScannerService.calculateFileHash(fileBuffer);

        return {
            fileName: secureFileName,
            originalName: file.originalname,
            filePath: finalPath,
            fileUrl: this.getFileUrl(patientId, fileType, secureFileName),
            fileSize: file.size,
            fileType: path.extname(file.originalname).substring(1),
            mimeType: file.mimetype,
            fileHash,
            uploadedAt: new Date()
        };
    }

    /**
     * Generate secure filename
     * @param {string} originalName - Original filename
     * @returns {string} Secure filename
     */
    static generateSecureFileName(originalName) {
        const ext = path.extname(originalName);
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');

        return `${timestamp}_${randomString}${ext}`;
    }

    /**
     * Get storage path for file
     * @param {string} patientId - Patient ID
     * @param {string} fileType - File type
     * @returns {string} Storage path
     */
    static getStoragePath(patientId, fileType) {
        if (!/^[a-f\d-]{36}$/i.test(patientId) || !['lab_results', 'imaging'].includes(fileType)) throw new Error('Invalid storage location');
        const baseDir = path.resolve(config.upload.uploadPath, 'medical_files');
        return path.join(baseDir, patientId, fileType);
    }

    /**
     * Get file URL
     * @param {string} patientId - Patient ID
     * @param {string} fileType - File type
     * @param {string} fileName - File name
     * @returns {string} File URL
     */
    static getFileUrl(patientId, fileType, fileName) {
        return `/api/files/${patientId}/${fileType}/${fileName}`;
    }

    /**
     * Validate file type
     * @param {string} mimeType - MIME type
     * @param {string} allowedTypes - Allowed types
     * @returns {boolean} True if valid
     */
    static validateFileType(mimeType, allowedTypes = []) {
        const defaultAllowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/dicom',
            'text/plain',
            'text/xml',
            'text/csv'
        ];

        const types = allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes;
        return types.includes(mimeType);
    }

    /**
     * Validate file size
     * @param {number} size - File size in bytes
     * @param {number} maxSize - Maximum size in bytes
     * @returns {boolean} True if valid
     */
    static validateFileSize(size, maxSize = 100 * 1024 * 1024) {
        return size <= maxSize;
    }

    /**
     * Delete file
     * @param {string} filePath - File path
     * @returns {Promise<void>}
     */
    static async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // File doesn't exist, ignore
        }
    }

    /**
     * Get file from storage
     * @param {string} filePath - File path
     * @returns {Promise<Buffer>} File buffer
     */
    static async getFile(filePath) {
        return decryptBuffer(await fs.readFile(filePath), this.encryptionContext(filePath));
    }

    static encryptionContext(filePath) {
        const relative = path.relative(path.resolve(config.upload.uploadPath), path.resolve(filePath));
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid encrypted file location');
        return relative.split(path.sep).join('/');
    }

    /**
     * Check if file exists
     * @param {string} filePath - File path
     * @returns {Promise<boolean>} True if exists
     */
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file stats
     * @param {string} filePath - File path
     * @returns {Promise<Object>} File stats
     */
    static async getFileStats(filePath) {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
        };
    }
}

module.exports = FileUploadService;
