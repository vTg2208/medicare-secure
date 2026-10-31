import apiClient from './client';

export const patientApi = {
    // Get patient profile summary (Name, ID, etc.)
    getProfile: async () => {
        const response = await apiClient.get('/patient/profile');
        return response.data;
    },

    // Get health facts (for dashboard summary)
    getHealthFacts: async () => {
        const response = await apiClient.get('/patient/health-facts');
        return response.data;
    },

    // Get recent patient activities (visits, labs, meds)
    getActivities: async () => {
        const response = await apiClient.get('/patient/activities');
        return response.data;
    }
};

export default patientApi;
