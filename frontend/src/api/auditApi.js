// Audit API Client
import apiClient from './client';

export const auditApi = {
    // Get audit trail for logged-in patient
    getMyAuditTrail: async (params = {}) => {
        const { startDate, endDate, action, limit, offset } = params;
        const queryParams = new URLSearchParams();

        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
        if (action) queryParams.append('action', action);
        if (limit) queryParams.append('limit', limit);
        if (offset) queryParams.append('offset', offset);

        const response = await apiClient.get(`/audit/my-trail?${queryParams.toString()}`);
        return response.data;
    },
};

export default auditApi;
