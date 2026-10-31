import apiClient from './client';

export const complianceApi = {
    getDashboardStats: async () => {
        const response = await apiClient.get('/compliance/dashboard');
        return response.data;
    },

    getIncidents: async () => {
        const response = await apiClient.get('/compliance/incidents');
        return response.data;
    },

    updateIncidentStatus: async (id, status) => {
        const response = await apiClient.put(`/compliance/incidents/${id}`, { status });
        return response.data;
    },

    getGlobalAudits: async () => {
        const response = await apiClient.get('/compliance/global-audits');
        return response.data;
    },

    getConsentOverrides: async () => {
        const response = await apiClient.get('/compliance/consent-overrides');
        return response.data;
    },

    getProfile: async () => {
        const response = await apiClient.get('/compliance/profile');
        return response.data;
    },

    updateProfile: async (profileData) => {
        const response = await apiClient.put('/compliance/profile', profileData);
        return response.data;
    }
};
