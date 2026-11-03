const MedicalRecordModel = require('../../models/medical_record.model');
const DiagnosisModel = require('../../models/diagnosis.model');
const PrescriptionModel = require('../../models/prescription.model');
const LabResultModel = require('../../models/lab_result.model');
const ImagingReportModel = require('../../models/imaging_report.model');
const LabOrderModel = require('../../models/lab_order.model');
const ImagingOrderModel = require('../../models/imaging_order.model');
const FileUploadService = require('../../services/file.upload.service');
const DicomService = require('../../services/dicom.service');
const PrescriptionValidatorService = require('../../services/prescription.validator.service');
const DrugInteractionService = require('../../services/drug.interaction.service');
const { checkConsent } = require('../../models/consent.model');
const auditService = require('../../services/audit.service');
const db = require('../../config/db');
const logger = require('../../utils/logger');

class EmrController {
    // ==================== Medical Records ====================

    /**
     * Create medical record
     * Requires WRITE consent to create new records
     */
    static async createMedicalRecord(req, res) {
        try {
            const { patientId, visitId, type, title, description } = req.body;
            const createdBy = req.user.id;

            // Validate visit linkage
            if (visitId) {
                await MedicalRecordModel.validateVisitLinkage(visitId);
            }

            // Always create records as immutable (no editing allowed)
            const record = await MedicalRecordModel.create({
                patientId,
                visitId,
                type,
                title,
                description,
                createdBy,
                immutableFlag: true  // All medical records are immutable
            });

            res.status(201).json({
                success: true,
                message: 'Medical record created successfully',
                data: record
            });
        } catch (error) {
            logger.error('Create medical record error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create medical record'
            });
        }
    }

    /**
     * Get medical record by ID
     */
    static async getMedicalRecord(req, res) {
        try {
            const { recordId } = req.params;
            const { includeRelated } = req.query;

            let record;
            if (includeRelated === 'true') {
                record = await MedicalRecordModel.findByIdWithRelated(recordId);
            } else {
                record = await MedicalRecordModel.findById(recordId);
            }

            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: 'Medical record not found'
                });
            }

            record.corrections = await require('../privacy/privacy-fulfillment.service').correctionsForRecord(recordId,db.query);

            res.json({
                success: true,
                data: record
            });
        } catch (error) {
            logger.error('Get medical record error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve medical record'
            });
        }
    }

    /**
     * Get medical records for patient
     * Requires active consent for doctors/staff, patients can view their own
     */
    static async getPatientMedicalRecords(req, res) {
        try {
            const { patientId } = req.params;
            const { type, visitId, search, summary } = req.query;
            const { limit, offset } = require('../../utils/pagination').pagination(req.query);
            const userId = req.user.id;
            const userRole = req.user.roleName.toUpperCase();

            // Patients can only view their own records
            if (userRole === 'PATIENT' && patientId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view your own medical records'
                });
            }

            const [records, count] = await Promise.all([
                MedicalRecordModel.findByPatientId(patientId, { type, visitId, search, summary: summary === 'true', limit, offset }),
                MedicalRecordModel.countByPatient(patientId, type, visitId, search)
            ]);

            // Create audit log ONLY if accessing user is NOT the patient owner
            // Patients don't need to see their own "viewed records" dashboard refresh clutter
            if (userRole !== 'PATIENT' || userId !== patientId) {
                await auditService.createAuditLog({
                    userId,
                    action: 'view_patient_records',
                    entityType: 'patient',
                    entityId: patientId,
                    purpose: 'Medical record review',
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    requestMethod: 'GET',
                    requestPath: req.originalUrl,
                    statusCode: 200,
                    metadata: { type, patientId, recordCount: records.length, visitorRole: userRole }
                });
            }

            res.json({
                success: true,
                data: {
                    records,
                    pagination: {
                        total: count,
                        limit,
                        offset
                    }
                }
            });
        } catch (error) {
            logger.error('Get patient medical records error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve medical records'
            });
        }
    }

    // ==================== Diagnoses ====================

    /**
     * Create diagnosis
     */
    static async createDiagnosis(req, res) {
        try {
            const { recordId, icdCode, description, severity, status, isPrimary, notes } = req.body;
            const diagnosedBy = req.user.id;

            // Validate ICD code
            if (!DiagnosisModel.validateIcdCode(icdCode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid ICD code format'
                });
            }

            const diagnosis = await DiagnosisModel.create({
                recordId,
                icdCode,
                description,
                severity,
                status,
                isPrimary,
                notes,
                diagnosedBy
            });

            res.status(201).json({
                success: true,
                message: 'Diagnosis created successfully',
                data: diagnosis
            });
        } catch (error) {
            logger.error('Create diagnosis error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create diagnosis'
            });
        }
    }

    /**
     * Create diagnosis addendum
     */
    static async createDiagnosisAddendum(req, res) {
        try {
            const { diagnosisId } = req.params;
            const addendumData = {
                ...req.body,
                diagnosedBy: req.user.id
            };

            const newVersion = await DiagnosisModel.createAddendum(diagnosisId, addendumData);

            res.status(201).json({
                success: true,
                message: 'Diagnosis addendum created successfully',
                data: newVersion
            });
        } catch (error) {
            logger.error('Create diagnosis addendum error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create diagnosis addendum'
            });
        }
    }

    /**
     * Update diagnosis status
     */
    static async updateDiagnosisStatus(req, res) {
        try {
            const { diagnosisId } = req.params;
            const { status } = req.body;

            const diagnosis = await DiagnosisModel.updateStatus(diagnosisId, status);

            res.json({
                success: true,
                message: 'Diagnosis status updated successfully',
                data: diagnosis
            });
        } catch (error) {
            logger.error('Update diagnosis status error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to update diagnosis status'
            });
        }
    }

    /**
     * Get diagnoses for a visit
     */
    static async getDiagnoses(req, res) {
        try {
            const { visitId } = req.params;

            const diagnoses = await DiagnosisModel.findByVisitId(visitId);

            res.json({
                success: true,
                data: diagnoses
            });
        } catch (error) {
            logger.error('Get diagnoses error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve diagnoses'
            });
        }
    }

    // ==================== Prescriptions ====================

    /**
     * Create prescription with validation
     */
    static async createPrescription(req, res) {
        try {
            const prescriptionData = {
                ...req.body,
                prescribedBy: req.user.id
            };

            // Get patient ID from record
            const record = await MedicalRecordModel.findById(prescriptionData.recordId);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: 'Medical record not found'
                });
            }

            // Validate prescription
            const validation = await PrescriptionValidatorService.validatePrescription(
                prescriptionData,
                record.patient_id,
                req.body.patientAllergies || []
            );

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: 'Prescription validation failed',
                    errors: validation.errors,
                    warnings: validation.warnings
                });
            }

            // Create prescription
            const prescription = await PrescriptionModel.create(prescriptionData);

            res.status(201).json({
                success: true,
                message: 'Prescription created successfully',
                data: prescription,
                validation: {
                    warnings: validation.warnings,
                    safetyCheck: validation.safetyCheck
                }
            });
        } catch (error) {
            logger.error('Create prescription error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create prescription'
            });
        }
    }

    /**
     * Get prescriptions for a visit
     */
    static async getPrescriptions(req, res) {
        try {
            const { visitId } = req.params;
            const prescriptions = await PrescriptionModel.findByVisitId(visitId);

            res.json({
                success: true,
                data: prescriptions
            });
        } catch (error) {
            logger.error('Get prescriptions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve prescriptions'
            });
        }
    }

    /**
     * Check drug interactions
     */
    static async checkDrugInteractions(req, res) {
        try {
            const { patientId, medication } = req.body;

            const result = await DrugInteractionService.checkPatientDrugInteractions(
                patientId,
                medication
            );

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('Check drug interactions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check drug interactions'
            });
        }
    }

    /**
     * Update prescription status
     */
    static async updatePrescriptionStatus(req, res) {
        try {
            const { prescriptionId } = req.params;
            const { status } = req.body;

            const allowedActions = req.user.roleName === 'pharmacist' ? ['completed']
                : req.user.roleName === 'doctor' ? ['active', 'cancelled', 'expired'] : [];
            if (!allowedActions.includes(status)) return res.status(403).json({
                success: false, message: 'Your role cannot perform this prescription action'
            });

            // Validate status transition
            const validation = await PrescriptionValidatorService.validateStatusUpdate(
                prescriptionId,
                status
            );

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.message,
                    allowedStatuses: validation.allowedStatuses
                });
            }

            const prescription = await PrescriptionModel.updateStatus(
                prescriptionId,
                status,
                req.user.id
            );

            res.json({
                success: true,
                message: 'Prescription status updated successfully',
                data: prescription
            });
        } catch (error) {
            logger.error('Update prescription status error:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to update prescription status'
            });
        }
    }

    // ==================== Lab Results ====================

    /**
     * Upload lab result
     */
    static async uploadLabResult(req, res) {
        let fileInfo, committed = false;
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const {
                recordId,
                testName,
                testCode,
                testCategory,
                resultsData,
                interpretation,
                referenceRange,
                abnormalFlag,
                performedBy,
                resultDate
            } = req.body;

            // Get patient ID from record
            const record = await MedicalRecordModel.findById(recordId);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: 'Medical record not found'
                });
            }

            // Process file upload
            fileInfo = await FileUploadService.processUpload(req.file, {
                patientId: record.patient_id,
                recordId,
                fileType: 'lab_results',
                scanForMalware: true
            });

            // Create lab result record
            const labResult = await LabResultModel.create({
                recordId,
                testName,
                testCode,
                testCategory,
                fileUrl: fileInfo.fileUrl,
                fileName: fileInfo.fileName,
                fileType: fileInfo.fileType,
                fileSize: fileInfo.fileSize,
                resultsData: resultsData ? JSON.parse(resultsData) : null,
                interpretation,
                referenceRange,
                abnormalFlag: abnormalFlag === 'true',
                orderedBy: req.user.id,
                performedBy: req.user.id,
                resultDate
            });
            committed = true;

            res.status(201).json({
                success: true,
                message: 'Lab result uploaded successfully',
                data: labResult
            });
        } catch (error) {
            if (!committed && fileInfo?.filePath) await FileUploadService.deleteFile(fileInfo.filePath).catch(() => {});
            logger.error('Upload lab result error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to upload lab result'
            });
        }
    }

    /**
     * Create lab order
     */
    static async createLabOrder(req, res) {
        try {
            const { visitId, testName, testCode, testCategory, priority, clinicalIndication, notes } = req.body;
            const orderedBy = req.user.id;

            const order = await LabOrderModel.createOrder({
                visitId,
                orderedBy,
                testName,
                testCode,
                testCategory,
                priority,
                clinicalIndication,
                notes
            });

            res.status(201).json({
                success: true,
                message: 'Lab order created successfully',
                data: order
            });
        } catch (error) {
            logger.error('Create lab order error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create lab order'
            });
        }
    }

    /**
     * Get lab orders for a visit
     */
    static async getLabOrders(req, res) {
        try {
            const { visitId } = req.params;
            const orders = await LabOrderModel.getVisitOrders(visitId);

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Get lab orders error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve lab orders'
            });
        }
    }

    // ==================== Imaging Reports ====================

    /**
     * Upload imaging report
     * Accepts a record, visit or order and publishes the report atomically.
     * If orderId is provided, the imaging order is marked as completed.
     */
    static async uploadImagingReport(req, res) {
        let fileInfo;
        let committed = false;
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const { orderId, imagingType, bodyPart, findings, impression, radiologistNotes, studyDate } = req.body;

            // Check if file is DICOM
            const fileBuffer = req.file.buffer || await require('fs/promises').readFile(req.file.path);
            const isDicom = DicomService.isDicomFile(fileBuffer);

            let dicomMetadata = null;
            if (isDicom) {
                try {
                    dicomMetadata = DicomService.extractMetadata(fileBuffer);
                } catch (error) {
                    logger.warn('DICOM metadata extraction failed', error);
                }
            }

            // Process file upload
            fileInfo = await FileUploadService.processUpload(req.file, {
                patientId: req.clinicalContext.patient_id,
                fileType: 'imaging',
                scanForMalware: true
            });
            const imagingReport = await db.transaction(async client => {
                let order;
                if (orderId) {
                    order = (await client.query(`SELECT io.*,v.patient_id FROM imaging_orders io JOIN visits v ON v.id=io.visit_id
                        WHERE io.id=$1 FOR UPDATE OF io`, [orderId])).rows[0];
                    if (!order) throw Object.assign(new Error('Imaging order not found'), { statusCode: 404 });
                    if (['completed', 'cancelled'].includes(order.status)) throw Object.assign(new Error('Imaging order is not open'), { statusCode: 409 });
                    if (order.patient_id !== req.clinicalContext.patient_id) throw Object.assign(new Error('Imaging order does not match the patient'), { statusCode: 400 });
                }
                const visitId = req.body.visitId || order?.visit_id || req.clinicalContext.visit_id;
                const typeMap = { 'x-ray': 'x-ray', xray: 'x-ray', ct: 'ct_scan', 'ct scan': 'ct_scan', ct_scan: 'ct_scan',
                    mri: 'mri', ultrasound: 'ultrasound', pet: 'pet_scan', pet_scan: 'pet_scan', mammogram: 'mammogram', mammography: 'mammogram', dicom: 'dicom' };
                const reportType = typeMap[String(imagingType || order?.imaging_type || (isDicom ? 'dicom' : 'other')).toLowerCase()] || 'other';
                let record;
                if (req.body.recordId) {
                    record = (await client.query('SELECT id,patient_id,visit_id FROM medical_records WHERE id=$1', [req.body.recordId])).rows[0];
                    if (!record) throw Object.assign(new Error('Medical record not found'), { statusCode: 404 });
                } else if (visitId) {
                    record = await MedicalRecordModel.create({
                        patientId: req.clinicalContext.patient_id, visitId, type: 'imaging',
                        title: `Imaging Report - ${imagingType || 'General'}`, description: findings || impression || null,
                        createdBy: req.user.id, immutableFlag: true
                    }, client);
                } else throw Object.assign(new Error('A valid record, visit or order is required'), { statusCode: 400 });
                if (record.patient_id !== req.clinicalContext.patient_id || (order && record.visit_id !== order.visit_id)) {
                    throw Object.assign(new Error('Medical record does not match the imaging order'), { statusCode: 400 });
                }
                const report = await ImagingReportModel.create({
                    recordId: record.id, imagingType: reportType, bodyPart: bodyPart || order?.body_part,
                    fileUrl: fileInfo.fileUrl, fileName: fileInfo.fileName, fileType: fileInfo.fileType, fileSize: fileInfo.fileSize,
                    isDicom, dicomMetadata, findings, impression, radiologistNotes,
                    orderedBy: order?.ordered_by || req.user.id, performedBy: req.user.id, reportedBy: req.user.id, studyDate
                }, client);
                if (order) await client.query(`UPDATE imaging_orders SET status='completed',imaging_report_id=$1,
                    performed_at=NOW(),completed_at=NOW(),updated_at=NOW() WHERE id=$2`, [report.id, orderId]);
                return report;
            });
            committed = true;

            res.status(201).json({
                success: true,
                message: 'Imaging report uploaded successfully',
                data: imagingReport,
                isDicom
            });
        } catch (error) {
            if (!committed && fileInfo?.filePath) await FileUploadService.deleteFile(fileInfo.filePath).catch(() => {});
            logger.error('Upload imaging report error:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Failed to upload imaging report'
            });
        }
    }

    /**
     * Create imaging order
     */
    static async createImagingOrder(req, res) {
        try {
            const { visitId, imagingType, bodyPart, priority, clinicalIndication, contrastUsed, notes } = req.body;
            const orderedBy = req.user.id;

            const order = await ImagingOrderModel.createOrder({
                visitId,
                orderedBy,
                imagingType,
                bodyPart,
                priority,
                clinicalIndication,
                contrastUsed,
                notes
            });

            res.status(201).json({
                success: true,
                message: 'Imaging order created successfully',
                data: order
            });
        } catch (error) {
            logger.error('Create imaging order error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to create imaging order'
            });
        }
    }

    /**
     * Get imaging orders for a visit
     */
    static async getImagingOrders(req, res) {
        try {
            const { visitId } = req.params;
            const orders = await ImagingOrderModel.getVisitOrders(visitId);

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Get imaging orders error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve imaging orders'
            });
        }
    }
    /**
     * Get all imaging orders for the radiologist queue
     * Returns orders routed to Radiology departments, with patient/doctor info
     */
    static async getMyImagingOrders(req, res) {
        try {
            const { status, limit, offset } = req.query;

            const orders = await ImagingOrderModel.getAllRadiologyOrders({
                status,
                userId: req.user.id,
                roleName: req.user.roleName,
                limit: Math.min(100, Math.max(1, parseInt(limit) || 100)),
                offset: parseInt(offset) || 0
            });

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Get radiologist imaging orders error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve imaging orders'
            });
        }
    }
}

module.exports = EmrController;
