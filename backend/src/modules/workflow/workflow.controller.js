/**
 * Workflow Controller
 * Handles all Epic 4 clinical workflow endpoints
 */

const OneTimeTokenService = require('../../utils/oneTimeToken.service');
const VisitLifecycleService = require('../../services/visit.lifecycle.service');
const CareTeamModel = require('../../models/care_team.model');
const LabOrderModel = require('../../models/lab_order.model');
const ImagingOrderModel = require('../../models/imaging_order.model');
const MedicationOrderModel = require('../../models/medication_order.model');
const NotificationService = require('../../services/notification.service');
const BedAllocationModel = require('../../models/bed_allocation.model');
const WorkflowLoggerService = require('../../services/workflow.logger.service');
const DynamicVisitEvaluatorService = require('../../services/visit.evaluator.service');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');
const { resolveResource, clinicalAccess } = require('../../middleware/clinical-access.middleware');

// ============================================
// ONE-TIME TOKENS
// ============================================

const generateToken = async (req, res) => {
    try {
        const { userId, scope, expiresInMinutes = 30 } = req.body;
        if (req.user.roleName !== 'patient' || (userId && userId !== req.user.id)) return res.status(403).json({ success: false, message: 'Patients may only grant access to their own resources' });
        if (!scope || !['visit', 'medical_record'].includes(scope.resourceType) || !Array.isArray(scope.permissions) || scope.permissions.length !== 1 || scope.permissions[0] !== 'read'
            || !Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > 60) return res.status(400).json({ success: false, message: 'A read-only visit or record grant expiring within 60 minutes is required' });
        const context = await resolveResource(scope.resourceType === 'visit' ? 'visit' : 'record', scope.resourceId);
        if (context.patient_id !== req.user.id) return res.status(403).json({ success: false, message: 'Resource ownership is required' });
        const token = await OneTimeTokenService.generateToken({ userId: req.user.id, createdBy: req.user.id, scope, expiresInMinutes });
        res.status(201).json({ success: true, data: token });
    } catch (error) { res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to create temporary access grant' }); }
};

const validateToken = async (req, res) => {
    try {
        const { token } = req.body;
        const inspected = OneTimeTokenService.inspectToken(token);
        const scope = inspected.scope;
        if (!scope || !['visit', 'medical_record'].includes(scope.resourceType) || scope.permissions?.length !== 1 || scope.permissions[0] !== 'read') return res.status(400).json({ success: false, message: 'Invalid access scope' });
        // A token conveys an owned resource, and never bypasses a clinician's consent/care policy.
        let authorized = false;
        await clinicalAccess({ resource: scope.resourceType === 'visit' ? 'visit' : 'record', id: () => scope.resourceId, roles: ['doctor', 'nurse', 'lab_technician', 'radiologist', 'pharmacist'] })(req, res, () => { authorized = true; });
        if (!authorized) return;
        if (req.clinicalContext.patient_id !== inspected.userId) return res.status(403).json({ success: false, message: 'Invalid grant owner' });
        const payload = await OneTimeTokenService.validateAndUseToken(token, req.ip);
        res.json({ success: true, data: payload });
    } catch (_) { res.status(401).json({ success: false, message: 'Invalid or already used access grant' }); }
};

// ============================================
// VISIT LIFECYCLE
// ============================================

const transitionVisitState = async (req, res) => {
    try {
        const { id } = req.params;
        const { newState, reason } = req.body;
        const userId = req.user.id;

        const updatedVisit = await VisitLifecycleService.transitionState(
            id,
            newState,
            userId,
            reason
        );

        // Send notification
        await NotificationService.notifyVisitStateChange(userId, id, newState);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: updatedVisit
        });
    } catch (error) {
        logger.error('Transition visit state failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getVisitStateHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const history = await VisitLifecycleService.getStateHistory(id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: history
        });
    } catch (error) {
        logger.error('Get visit state history failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// CARE TEAM
// ============================================

const assignCareTeam = async (req, res) => {
    try {
        const { visitId, staffUserId, role, notes } = req.body;
        const assignedBy = req.user.id;

        const assignment = await CareTeamModel.assignStaff({
            visitId,
            staffUserId,
            role,
            assignedBy,
            notes
        });

        // Log action
        await WorkflowLoggerService.logCareTeamAssignment(
            visitId,
            assignedBy,
            staffUserId,
            role,
            req.ip
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        logger.error('Assign care team failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const removeCareTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const removedBy = req.user.id;

        const assignment = await CareTeamModel.removeStaff(id, removedBy);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: assignment
        });
    } catch (error) {
        logger.error('Remove care team failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getVisitCareTeam = async (req, res) => {
    try {
        const { id } = req.params;

        const careTeam = await CareTeamModel.getVisitCareTeam(id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: careTeam
        });
    } catch (error) {
        logger.error('Get visit care team failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// LAB ORDERS
// ============================================

const createLabOrder = async (req, res) => {
    try {
        const orderData = { ...req.body, orderedBy: req.user.id };

        const order = await LabOrderModel.createOrder(orderData);

        // Log action
        await WorkflowLoggerService.logOrderCreation(
            orderData.visitId,
            req.user.id,
            'lab',
            order.id,
            orderData,
            req.ip
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Create lab order failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const updateLabOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, ...additionalData } = req.body;

        const order = await LabOrderModel.updateStatus(id, status, additionalData);

        // Notify if completed
        if (status === 'completed' && order.ordered_by) {
            await NotificationService.notifyLabResultAvailable(
                order.ordered_by,
                order.id,
                order.test_name
            );
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Update lab order status failed:', error);
        res.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getVisitLabOrders = async (req, res) => {
    try {
        const { id } = req.params;

        const orders = await LabOrderModel.getVisitOrders(id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: orders
        });
    } catch (error) {
        logger.error('Get visit lab orders failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// IMAGING ORDERS
// ============================================

const createImagingOrder = async (req, res) => {
    try {
        const orderData = { ...req.body, orderedBy: req.user.id };

        const order = await ImagingOrderModel.createOrder(orderData);

        // Log action
        await WorkflowLoggerService.logOrderCreation(
            orderData.visitId,
            req.user.id,
            'imaging',
            order.id,
            orderData,
            req.ip
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Create imaging order failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const updateImagingOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, ...additionalData } = req.body;

        const order = await ImagingOrderModel.updateStatus(id, status, additionalData);

        // Notify if completed
        if (status === 'completed' && order.ordered_by) {
            await NotificationService.notifyImagingReportAvailable(
                order.ordered_by,
                order.id,
                order.imaging_type
            );
        }

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Update imaging order status failed:', error);
        res.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getVisitImagingOrders = async (req, res) => {
    try {
        const { id } = req.params;

        const orders = await ImagingOrderModel.getVisitOrders(id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: orders
        });
    } catch (error) {
        logger.error('Get visit imaging orders failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// MEDICATION ORDERS
// ============================================

const createMedicationOrder = async (req, res) => {
    try {
        const orderData = { ...req.body, orderedBy: req.user.id };

        const order = await MedicationOrderModel.createOrder(orderData);

        // Log action
        await WorkflowLoggerService.logOrderCreation(
            orderData.visitId,
            req.user.id,
            'medication',
            order.id,
            orderData,
            req.ip
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Create medication order failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const administerMedication = async (req, res) => {
    try {
        const { id } = req.params;
        const administeredBy = req.user.id;

        const order = await MedicationOrderModel.recordAdministration(id, administeredBy);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Administer medication failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getVisitMedicationOrders = async (req, res) => {
    try {
        const { id } = req.params;

        const orders = await MedicationOrderModel.getVisitOrders(id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: orders
        });
    } catch (error) {
        logger.error('Get visit medication orders failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// NOTIFICATIONS
// ============================================

const sendNotification = async (req, res) => {
    try {
        const notification = await NotificationService.sendNotification(req.body);

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: notification
        });
    } catch (error) {
        logger.error('Send notification failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { unreadOnly } = req.query;

        const notifications = await NotificationService.getUserNotifications(
            userId,
            unreadOnly === 'true'
        );

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        logger.error('Get user notifications failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await NotificationService.markAsRead(id, req.user.id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: notification
        });
    } catch (error) {
        logger.error('Mark notification read failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// BED ALLOCATION
// ============================================

const allocateBed = async (req, res) => {
    try {
        const allocationData = { ...req.body, room: req.body.room ?? req.body.roomNumber, bed: req.body.bed ?? req.body.bedNumber, allocatedBy: req.user.id };

        const allocation = await BedAllocationModel.allocateBed(allocationData);

        // Log action
        await WorkflowLoggerService.logBedAllocation(
            allocationData.visitId,
            req.user.id,
            allocation.id,
            allocationData,
            req.ip
        );

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            data: allocation
        });
    } catch (error) {
        logger.error('Allocate bed failed:', error);
        res.status(error.statusCode || HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const releaseBed = async (req, res) => {
    try {
        const { id } = req.params;
        const releasedBy = req.user.id;

        const allocation = await BedAllocationModel.releaseBed(id, releasedBy);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: allocation
        });
    } catch (error) {
        logger.error('Release bed failed:', error);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

const getAvailableBeds = async (req, res) => {
    try {
        const { ward, bedType } = req.query;

        const beds = await BedAllocationModel.getAvailableBeds(ward, bedType, req.organizationId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: beds
        });
    } catch (error) {
        logger.error('Get available beds failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// VISIT EVALUATION
// ============================================

const evaluateVisit = async (req, res) => {
    try {
        const { id } = req.params;

        const evaluation = await DynamicVisitEvaluatorService.evaluateVisit(id);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: evaluation
        });
    } catch (error) {
        logger.error('Evaluate visit failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================
// WORKFLOW LOGS
// ============================================

const getWorkflowLogs = async (req, res) => {
    try {
        const { visitId, action, entityType, startDate, endDate, limit } = req.query;

        const logs = await WorkflowLoggerService.getVisitLogs(visitId, {
            action,
            entityType,
            startDate,
            endDate,
            limit: limit ? parseInt(limit) : 100
        });

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: logs
        });
    } catch (error) {
        logger.error('Get workflow logs failed:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    // Tokens
    generateToken,
    validateToken,
    // Visit Lifecycle
    transitionVisitState,
    getVisitStateHistory,
    // Care Team
    assignCareTeam,
    removeCareTeam,
    getVisitCareTeam,
    // Lab Orders
    createLabOrder,
    updateLabOrderStatus,
    getVisitLabOrders,
    // Imaging Orders
    createImagingOrder,
    updateImagingOrderStatus,
    getVisitImagingOrders,
    // Medication Orders
    createMedicationOrder,
    administerMedication,
    getVisitMedicationOrders,
    // Notifications
    sendNotification,
    getUserNotifications,
    markNotificationRead,
    // Bed Allocation
    allocateBed,
    releaseBed,
    getAvailableBeds,
    // Visit Evaluation
    evaluateVisit,
    // Workflow Logs
    getWorkflowLogs
};
