// Workflow API Client - Epic 4: Clinical Workflow
import apiClient from './client';

export const workflowApi = {
    // ============================================
    // ONE-TIME TOKENS
    // ============================================
    generateToken: async (purpose, expiresIn) => {
        const response = await apiClient.post('/workflow/tokens/generate', { purpose, expiresIn });
        return response.data;
    },

    validateToken: async (token, purpose) => {
        const response = await apiClient.post('/workflow/tokens/validate', { token, purpose });
        return response.data;
    },

    // ============================================
    // VISIT LIFECYCLE
    // ============================================
    transitionVisitState: async (visitId, newState, notes) => {
        const response = await apiClient.patch(`/workflow/visits/${visitId}/state`, {
            state: newState,
            notes
        });
        return response.data;
    },

    getVisitStateHistory: async (visitId) => {
        const response = await apiClient.get(`/workflow/visits/${visitId}/history`);
        return response.data;
    },

    evaluateVisit: async (visitId) => {
        const response = await apiClient.get(`/workflow/visits/${visitId}/evaluate`);
        return response.data;
    },

    // ============================================
    // CARE TEAM
    // ============================================
    assignCareTeam: async (visitId, staffId, role, notes) => {
        const response = await apiClient.post('/workflow/care-team', {
            visitId,
            staffId,
            role,
            notes
        });
        return response.data;
    },

    removeCareTeam: async (assignmentId) => {
        const response = await apiClient.delete(`/workflow/care-team/${assignmentId}`);
        return response.data;
    },

    getVisitCareTeam: async (visitId) => {
        const response = await apiClient.get(`/workflow/visits/${visitId}/care-team`);
        return response.data;
    },

    // ============================================
    // LAB ORDERS
    // ============================================
    createLabOrder: async (orderData) => {
        const response = await apiClient.post('/workflow/lab-orders', orderData);
        return response.data;
    },

    updateLabOrderStatus: async (orderId, status, notes) => {
        const response = await apiClient.patch(`/workflow/lab-orders/${orderId}/status`, {
            status,
            notes
        });
        return response.data;
    },

    getVisitLabOrders: async (visitId) => {
        const response = await apiClient.get(`/workflow/visits/${visitId}/lab-orders`);
        return response.data;
    },

    // ============================================
    // IMAGING ORDERS
    // ============================================
    createImagingOrder: async (orderData) => {
        const response = await apiClient.post('/workflow/imaging-orders', orderData);
        return response.data;
    },

    updateImagingOrderStatus: async (orderId, status, notes) => {
        const response = await apiClient.patch(`/workflow/imaging-orders/${orderId}/status`, {
            status,
            notes
        });
        return response.data;
    },

    getVisitImagingOrders: async (visitId) => {
        const response = await apiClient.get(`/workflow/visits/${visitId}/imaging-orders`);
        return response.data;
    },

    // ============================================
    // MEDICATION ORDERS
    // ============================================
    createMedicationOrder: async (orderData) => {
        const response = await apiClient.post('/workflow/medication-orders', orderData);
        return response.data;
    },

    administerMedication: async (orderId, notes) => {
        const response = await apiClient.patch(`/workflow/medication-orders/${orderId}/administer`, { notes });
        return response.data;
    },

    getVisitMedicationOrders: async (visitId) => {
        const response = await apiClient.get(`/workflow/visits/${visitId}/medication-orders`);
        return response.data;
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================
    sendNotification: async (userId, type, message, priority, referenceId, referenceType) => {
        const response = await apiClient.post('/workflow/notifications', {
            userId,
            type,
            message,
            priority,
            referenceId,
            referenceType
        });
        return response.data;
    },

    getUserNotifications: async (unreadOnly = true) => {
        const params = unreadOnly ? { unread: true } : {};
        const response = await apiClient.get('/workflow/notifications', { params });
        return response.data;
    },

    markNotificationRead: async (notificationId) => {
        const response = await apiClient.patch(`/workflow/notifications/${notificationId}/read`);
        return response.data;
    },

    // ============================================
    // BED ALLOCATION
    // ============================================
    allocateBed: async (visitId, ward, roomNumber, bedNumber, notes) => {
        const response = await apiClient.post('/workflow/bed-allocations', {
            visitId,
            ward,
            roomNumber,
            bedNumber,
            notes
        });
        return response.data;
    },

    releaseBed: async (allocationId, dischargeNotes) => {
        const response = await apiClient.patch(`/workflow/bed-allocations/${allocationId}/release`, {
            dischargeNotes
        });
        return response.data;
    },

    getAvailableBeds: async (ward = null) => {
        const params = ward ? { ward } : {};
        const response = await apiClient.get('/workflow/bed-allocations/available', { params });
        return response.data;
    },
};

export default workflowApi;
