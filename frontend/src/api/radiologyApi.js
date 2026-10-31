import apiClient from './client';

class RadiologyApi {
    /**
     * Get system statistics for the radiologist dashboard
     */
    async getStats() {
        const response = await apiClient.get('/radiology/stats');
        return response.data;
    }

    /**
     * Get imaging orders, optionally filtered.
     * @param {Object} filters - e.g. { status: 'pending', priority: 'stat' }
     */
    async getOrders(filters = {}) {
        const params = new URLSearchParams(filters).toString();
        const url = params ? `/radiology/orders?${params}` : `/radiology/orders`;
        const response = await apiClient.get(url);
        return response.data;
    }

    /**
     * Upload an imaging report (multipart/form-data).
     * @param {FormData} formData - Contains visitId, orderId, imagingType, findings, file, etc.
     */
    async uploadReport(formData) {
        const response = await apiClient.post('/radiology/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    }

    /**
     * Get the radiologist profile
     */
    async getProfile() {
        const response = await apiClient.get('/radiology/profile');
        return response.data;
    }

    /**
     * Update the radiologist profile
     * @param {Object} data - Profile data payload
     */
    async updateProfile(data) {
        const response = await apiClient.put('/radiology/profile', data);
        return response.data;
    }

    /**
     * Get the radiologist audit logs
     */
    async getAuditLogs() {
        const response = await apiClient.get('/radiology/audit-logs');
        return response.data;
    }
}

export const radiologyApi = new RadiologyApi();
export default radiologyApi;
