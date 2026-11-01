const VisitModel = require('../../models/visit.model');
const VisitConsentService = require('../../services/visit-consent.service');
const pool = require('../../config/db');
const logger = require('../../utils/logger');
const { sendVisitApprovalEmail, sendVisitClosureEmail } = require('../../config/mail');

const VisitController = {
    /**
     * Patient requests a visit using hospital code
     */
    async requestVisit(req, res) {
        try {
            const { hospitalCode, reason, symptoms, doctorId, scheduledTime } = req.body;
            const patientId = req.user.id;

            if (scheduledTime !== undefined && (typeof scheduledTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledTime)
                || !Number.isFinite(Date.parse(scheduledTime)) || Date.parse(scheduledTime)<=Date.now() || !doctorId)) return res.status(400).json({success:false,message:'Choose a future appointment with a doctor'});

            if (!hospitalCode) {
                return res.status(400).json({ success: false, message: 'Hospital code is required' });
            }

            // 1. Find Organization by Code
            // We need a helper or direct query here since OrganizationModel might not have findByCode yet
            // Let's use direct query for now or add to OrgModel. Let's assume direct for speed.
            const orgRes = await require('../../config/db').query(
                "SELECT id, name FROM organizations WHERE hospital_code = $1 AND status='active' AND verified=true",
                [hospitalCode]
            );

            if (orgRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Invalid hospital code' });
            }

            const organization = orgRes.rows[0];

            if (doctorId) {
                const doctor = await pool.query(`SELECT s.user_id FROM staff_org_mapping s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id
                    WHERE s.user_id=$1 AND s.organization_id=$2 AND s.status='active' AND u.status='active' AND r.name='doctor'`,[doctorId,organization.id]);
                if (!doctor.rowCount) return res.status(403).json({success:false,message:'Doctor is not active in the selected clinic'});
            }

            // 2. Check for existing active visit
            const existingVisit = await VisitModel.findActiveByPatient(patientId);
            if (existingVisit && !scheduledTime) {
                return res.status(409).json({
                    success: false,
                    message: 'You already have an active visit request.',
                    data: existingVisit
                });
            }

            // 3. Create Visit
            const visit = await VisitModel.create({
                patientId,
                organizationId: organization.id,
                reason,
                symptoms,
                type: doctorId ? 'appointment' : 'walk_in',
                priority: 'normal',
                doctorId,
                scheduledTime
            });

            res.status(201).json({
                success: true,
                message: `Successfully requested visit at ${organization.name}`,
                data: visit
            });

        } catch (error) {
            logger.error('Request visit failed:', error);
            if (error.code === '23P01') return res.status(409).json({success:false,message:'This appointment was just reserved. Choose another available time.'});
            if (['22023','23514','22007','22008'].includes(error.code)) return res.status(400).json({success:false,message:'Choose a future available appointment from the clinic calendar'});
            res.status(500).json({ success: false, message: 'Failed to request visit' });
        }
    },

    /**
     * Get visits for the staff's organization
     */
    async getHospitalVisits(req, res) {
        try {
            const userId = req.user.id;
            // Get organization from mapping
            // Should be in req.user if updated middleware, but let's query to be safe
            const mappingRes = await require('../../config/db').query(
                'SELECT organization_id FROM staff_org_mapping WHERE user_id = $1 AND status = \'active\'',
                [userId]
            );

            if (mappingRes.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'You are not linked to any active organization' });
            }

            const organizationId = mappingRes.rows[0].organization_id;
            const tests = req.query.status;


            const visits = await VisitModel.findByOrganization(organizationId, {
                status: req.query.status,
                limit: req.query.limit,
                offset: req.query.offset
            });


            res.json({
                success: true,
                data: visits
            });

        } catch (error) {
            logger.error('Get hospital visits failed:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch visits' });
        }
    },

    /**
     * Get queue status for a specific visit
     */
    async getQueueStatus(req, res) {
        try {
            const { id } = req.params;
            const visit = await VisitModel.findById(id);

            if (!visit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            if (!visit.assigned_doctor_id) {
                return res.json({
                    success: true,
                    data: { position: 0, total: 0, status: visit.status, eta_minutes: 0, message: 'No doctor assigned yet' }
                });
            }

            const queueInfo = await VisitModel.getQueuePosition(id, visit.assigned_doctor_id);

            if (!queueInfo) {
                return res.status(404).json({ success: false, message: 'Queue info not found' });
            }

            res.json({
                success: true,
                data: queueInfo
            });
        } catch (error) {
            logger.error('Get queue status failed:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch queue status' });
        }
    },

    /**
     * Get visits for the logged-in patient
     */
    async getMyVisits(req, res) {
        try {
            const userId = req.user.id;
            const visits = await VisitModel.findByPatientId(userId);

            res.json({
                success: true,
                data: visits
            });
        } catch (error) {
            logger.error('Get my visits failed:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch visits' });
        }
    },

    /**
     * Get visits assigned to the logged-in doctor/nurse
     */
    async getAssignedVisits(req, res) {
        try {
            const userId = req.user.id;
            // Auth middleware sets roleName, fall back to role just in case
            const role = (req.user.roleName || req.user.role)?.toLowerCase();

            logger.info(`Fetching assigned visits for user ${userId} with role ${role}`);

            if (!['doctor', 'nurse'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Only doctors and nurses can view assigned visits' });
            }

            const visits = await VisitModel.findByAssignedStaff(userId, role);
            logger.info(`Found ${visits.length} assigned visits`);

            res.json({
                success: true,
                data: visits
            });
        } catch (error) {
            logger.error('Get assigned visits failed:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch assigned visits' });
        }
    },

    /**
     * Admin/Staff updates visit (Assign Dr, Change Status)
     */
    async updateVisit(req, res) {
        try {
            const { id } = req.params;
            if ('otpVerified' in req.body || 'accessLevel' in req.body) return res.status(403).json({ success: false, message: 'Only the patient may approve visit data access' });
            const { status, assignedDoctorId, assignedNurseId, scheduledTime } = req.body;
            const updateData = { status, assignedDoctorId, assignedNurseId, scheduledTime };

            // TODO: Add strict permission checks (e.g. only Admin/Doctor can assign)

            let updatedVisit;
            if (status) {
                if (Object.values({assignedDoctorId,assignedNurseId,scheduledTime}).some(value => value !== undefined)) return res.status(400).json({success:false,message:'Change visit state separately from staff assignments'});
                updatedVisit = await require('../../services/visit.lifecycle.service').transitionState(id,status,req.user.id);
            } else updatedVisit = await VisitModel.update(id,updateData);

            if (!updatedVisit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            res.json({
                success: true,
                message: 'Visit updated successfully',
                data: updatedVisit
            });

        } catch (error) {
            logger.error('Update visit failed:', error);
            res.status(500).json({ success: false, message: 'Failed to update visit' });
        }
    },

    /**
     * Admin approves visit, assigns staff, and generates OTP
     */
    async approveVisit(req, res) {
        try {
            const { id } = req.params;
            const { doctorId, nurseId, scheduledTime } = req.body;


            // Fetch the current visit to get existing doctor assignments
            const currentVisit = await VisitModel.findById(id);
            if (!currentVisit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            const finalDoctorId = doctorId || currentVisit.assigned_doctor_id || currentVisit.doctor_id; // Try to retain existing

            if (!finalDoctorId) {
                return res.status(400).json({ success: false, message: 'Doctor ID is required for approval' });
            }

            // First update scheduled time if provided
            if (scheduledTime) {
                const updateResult = await VisitModel.update(id, { scheduledTime });
            }

            // Approve visit and generate OTP
            const updatedVisit = await VisitModel.approveVisit(id, finalDoctorId, nurseId || null);

            if (!updatedVisit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            // Get full visit details for email
            const visitDetails = await VisitModel.getFullDetails(id);

            // Send approval email with visit code
            let emailSent = false;
            try {
                await sendVisitApprovalEmail(visitDetails.patient_email, {
                    visit_code: visitDetails.otp_code,
                    hospital_name: visitDetails.organization_name,
                    reason: visitDetails.chief_complaint || 'Protocol Assigned',
                    scheduled_date: visitDetails.created_at
                });
                emailSent = true;
                logger.info('Visit approval email sent');
            } catch (emailError) {
                logger.error('Failed to send visit approval email:', emailError);
                // Don't fail the request if email fails
            }

            res.json({
                success: true,
                message: emailSent
                    ? 'Visit approved successfully. Approval email sent to patient.'
                    : 'Visit approved successfully. Email delivery is unavailable; the patient can view details in the app.',
                data: {
                    ...updatedVisit,
                    // Return OTP for display to admin/patient
                    otp: updatedVisit.otp_code,
                    emailDelivery: emailSent ? 'sent' : 'failed'
                }
            });

        } catch (error) {
            logger.error('=== APPROVE VISIT ERROR ===');
            logger.error('Error details:', error);
            logger.error('Approve visit failed:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to approve visit' });
        }
    },

    /**
     * Patient verifies OTP and selects access level
     */
    async verifyVisitOTP(req, res) {
        try {
            const { id } = req.params;
            const { otp, accessLevel } = req.body;
            const patientId = req.user.id;

            if (!otp || !accessLevel) {
                return res.status(400).json({
                    success: false,
                    message: 'OTP and access level are required'
                });
            }

            if (!['read', 'write'].includes(accessLevel)) {
                return res.status(400).json({
                    success: false,
                    message: 'Access level must be "read" or "write"'
                });
            }

            // Verify OTP and update visit
            const updatedVisit = await VisitModel.verifyOTP(id, otp, accessLevel, patientId);

            // Get full visit details for consent creation
            const visitDetails = await VisitModel.getFullDetails(id);

            // Verify patient owns this visit
            if (visitDetails.patient_id !== patientId) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }

            res.json({
                success: true,
                message: 'OTP verified successfully. Doctor has been granted access.',
                data: {
                    visitId: updatedVisit.id,
                    status: updatedVisit.status,
                    accessLevel: updatedVisit.access_level
                }
            });

        } catch (error) {
            if (error.message === 'Invalid or expired OTP') {
                return res.status(400).json({ success: false, message: error.message });
            }
            logger.error('Verify OTP failed:', error);
            res.status(500).json({ success: false, message: 'Failed to verify OTP' });
        }
    },

    /**
     * Patient generates access code for a visit
     */
    async generateAccessCode(req, res) {
        try {
            const { id } = req.params;
            const patientId = req.user.id;

            // 1. Verify visit ownership
            const visit = await VisitModel.findById(id);

            if (!visit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            if (visit.patient_id !== patientId) {
                return res.status(403).json({ success: false, message: 'Unauthorized access to this visit' });
            }

            // 2. Generate Code
            const result = await VisitModel.generateAccessCode(id);
            if (!result) return res.status(409).json({ success: false, message: 'This visit is not waiting for patient approval' });

            res.json({
                success: true,
                message: 'Access code generated successfully',
                data: {
                    visitId: id,
                    accessCode: result.otp_code,
                    expiresAt: result.otp_expires_at
                }
            });

        } catch (error) {
            logger.error('Generate access code failed:', error);
            res.status(500).json({ success: false, message: 'Failed to generate access code' });
        }
    },

    /**
     * Patient check-in using visit code
     */
    async checkInVisit(req, res) {
        try {
            const { visitCode } = req.body;
            const patientId = req.user.id;


            if (!visitCode) {
                return res.status(400).json({ success: false, message: 'Visit code is required' });
            }

            // Find visit by code
            const visit = await VisitModel.findByCode(visitCode);

            if (!visit) {
                return res.status(404).json({ success: false, message: 'Invalid visit code' });
            }


            // Verify patient owns this visit
            if (visit.patient_id !== patientId) {
                return res.status(403).json({ success: false, message: 'This visit does not belong to you' });
            }

            // Check if visit is in approved status
            if (visit.status !== 'approved') {
                return res.status(400).json({
                    success: false,
                    message: `Cannot check in. Visit status is: ${visit.status}`
                });
            }

            // Update status to checked_in
            const updatedVisit = await VisitModel.updateStatus(visit.id, 'checked_in', patientId);

            res.json({
                success: true,
                message: 'Successfully checked in',
                data: updatedVisit
            });

        } catch (error) {
            logger.error('Check-in failed:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to check in',
            });
        }
    },

    /**
     * Close visit (complete or cancel)
     */
    async closeVisit(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body; // 'completed' or 'cancelled'
            const userId = req.user.id;

            if (!status || !['completed', 'cancelled'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be either completed or cancelled'
                });
            }

            // Close visit
            const closedVisit = await VisitModel.closeVisit(id, userId, status);

            if (!closedVisit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            // Automatically revoke associated consents
            try {
                await VisitConsentService.revokeConsentForVisit(id);
                logger.info(`Automatically revoked consents for closed visit ${id}`);
            } catch (revokeError) {
                logger.error(`Failed to automatically revoke consents for visit ${id}:`, revokeError);
                // Continue anyway
            }

            // Get full details for email
            const visitDetails = await VisitModel.getFullDetails(id);

            // Send closure email
            try {
                await sendVisitClosureEmail(visitDetails.patient_email, {
                    visit_code: visitDetails.visit_code,
                    hospital_name: visitDetails.organization_name,
                    status: status
                });
                logger.info('Visit closure email sent');
            } catch (emailError) {
                logger.error('Failed to send visit closure email:', emailError);
            }

            res.json({
                success: true,
                message: `Visit ${status} successfully. Staff access has been revoked.`,
                data: closedVisit
            });

        } catch (error) {
            logger.error('Close visit failed:', error);
            res.status(500).json({ success: false, message: 'Failed to close visit' });
        }
    },

    /**
     * Get staff assigned to a visit
     */
    async getVisitStaff(req, res) {
        try {
            const { id } = req.params;

            const staff = await VisitModel.getAssignedStaff(id);

            res.json({
                success: true,
                data: staff
            });

        } catch (error) {
            logger.error('Get visit staff failed:', error);
            res.status(500).json({ success: false, message: 'Failed to get visit staff' });
        }
    },

    /**
     * Assign additional staff to visit
     */
    async assignStaff(req, res) {
        try {
            const { id } = req.params;
            const { staffUserId, role } = req.body;

            if (!staffUserId || !role) {
                return res.status(400).json({
                    success: false,
                    message: 'Staff user ID and role are required'
                });
            }

            const assignment = await VisitModel.assignStaff(id, staffUserId, role);

            res.json({
                success: true,
                message: 'Staff assigned successfully',
                data: assignment
            });

        } catch (error) {
            logger.error('Assign staff failed:', error);
            res.status(500).json({ success: false, message: 'Failed to assign staff' });
        }
    },

    /**
     * Receptionist: Update scheduled time for a single visit
     */
    async updateScheduledTime(req, res) {
        try {
            const { id } = req.params;
            const { scheduledTime } = req.body;

            if (!scheduledTime) {
                return res.status(400).json({ success: false, message: 'scheduledTime is required' });
            }

            const updatedVisit = await VisitModel.update(id, { scheduledTime });

            if (!updatedVisit) {
                return res.status(404).json({ success: false, message: 'Visit not found' });
            }

            res.json({
                success: true,
                message: 'Scheduled time updated successfully',
                data: updatedVisit
            });

        } catch (error) {
            logger.error('Update scheduled time failed:', error);
            if (error.code === '23P01') return res.status(409).json({success:false,message:'This appointment is already reserved'});
            if (['22023','23514','22007','22008'].includes(error.code)) return res.status(400).json({success:false,message:'Choose a future available appointment from the clinic calendar'});
            res.status(500).json({ success: false, message: 'Failed to update scheduled time' });
        }
    }
};

module.exports = VisitController;
