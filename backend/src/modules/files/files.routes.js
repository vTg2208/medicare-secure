const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { authenticate } = require('../../middleware/auth.middleware');
const { clinicalAccess } = require('../../middleware/clinical-access.middleware');
const { asyncHandler } = require('../../middleware/error.middleware');
const { createAuditLog } = require('../../services/audit.service');
const FileUploadService = require('../../services/file.upload.service');
const { query } = require('../../config/db');
const router = express.Router();
router.get('/:patientId/:fileType/:fileName', authenticate,
    clinicalAccess({ resource: 'patient', id: req => req.params.patientId, category: req => req.params.fileType === 'lab_results' ? 'lab_results' : 'imaging' }),
    asyncHandler(async (req, res) => {
        const { patientId, fileType, fileName } = req.params;
        if (!['lab_results', 'imaging'].includes(fileType) || !/^\d+_[a-f\d]{16}\.[a-z0-9]{1,8}$/i.test(fileName)) {
            return res.status(400).json({ success: false, message: 'Invalid file identifier' });
        }
        const url = `/api/files/${patientId}/${fileType}/${fileName}`;
        const legacy = `/uploads/medical_files/${patientId}/${fileType}/${fileName}`;
        const ref = await query(`SELECT 1 FROM lab_results l JOIN medical_records r ON l.record_id = r.id
            WHERE r.patient_id = $1 AND l.file_url IN ($2,$3)
            UNION ALL SELECT 1 FROM imaging_reports i JOIN medical_records r ON i.record_id = r.id
            WHERE r.patient_id = $1 AND i.file_url IN ($2,$3)
            UNION ALL SELECT 1 FROM radiology_reports WHERE patient_id = $1 AND file_path IN ($2,$3) LIMIT 1`, [patientId, url, legacy]);
        if (!ref.rowCount) return res.status(404).json({ success: false, message: 'File not found' });
        const file = path.join(FileUploadService.getStoragePath(patientId, fileType), fileName);
        try {
            const data = await FileUploadService.getFile(file);
            const event = await createAuditLog({ userId: req.user.id, action: 'download_medical_file', entityType: 'patient', entityId: patientId,
                statusCode: 200, metadata: { patientId, emergencyGrantId: req.emergencyGrantId || null } });
            if (!event) return res.status(503).json({ success: false, message: 'The file cannot be downloaded while auditing is unavailable' });
            res.attachment(fileName).type('application/octet-stream').send(data);
        } catch (error) {
            if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'File not found' });
            throw error;
        }
    }));
module.exports = router;
