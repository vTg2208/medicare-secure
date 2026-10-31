import apiClient from './client';

/**
 * Pharmacist API — uses the shared apiClient (real JWT, correct base URL)
 * All routes → /api/pharmacist/*
 */
export const pharmacistApi = {
    /**
     * GET /api/pharmacist/stats
     * Dashboard statistics: pending Rx, dispensed today, low stock, refill requests
     */
    getDashboardStats: async () => {
        const response = await apiClient.get('/pharmacist/stats');
        return response.data;
    },

    /**
     * GET /api/pharmacist/prescriptions?status=pending|dispensed|all
     * Returns prescription queue with patient and prescriber names
     */
    getPrescriptions: async (status = 'all') => {
        const response = await apiClient.get('/pharmacist/prescriptions', {
            params: { status }
        });
        return response.data;
    },

    /**
     * PUT /api/pharmacist/prescriptions/:id/dispense
     * Mark a prescription as dispensed (completed)
     */
    dispensePrescription: async (id) => {
        const response = await apiClient.put(`/pharmacist/prescriptions/${id}/dispense`);
        return response.data;
    },

    /**
     * GET /api/pharmacist/inventory
     * Medication inventory with In Stock / Low Stock / Out of Stock status
     */
    getInventory: async () => {
        const response = await apiClient.get('/pharmacist/inventory');
        return response.data;
    },

    /**
     * GET /api/pharmacist/profile
     */
    getProfile: async () => {
        const response = await apiClient.get('/pharmacist/profile');
        return response.data;
    },

    /**
     * PUT /api/pharmacist/profile
     * @param {Object} data - { firstName, lastName, phone }
     */
    updateProfile: async (data) => {
        const response = await apiClient.put('/pharmacist/profile', data);
        return response.data;
    },

    /**
     * GET /api/pharmacist/audit-logs
     */
    getAuditLogs: async () => {
        const response = await apiClient.get('/pharmacist/audit-logs');
        return response.data;
    }
};

export default pharmacistApi;
