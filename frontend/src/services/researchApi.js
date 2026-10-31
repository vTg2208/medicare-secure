import apiClient from '../api/client';

export const researchApi = {
    // Analytics Dashboard
    getStats: async () => {
        const response = await apiClient.get('/research/stats');
        return response.data;
    },

    // Detailed Data Explorer Views
    getSymptoms: async () => {
        const response = await apiClient.get('/research/symptoms');
        return response.data;
    },

    getTreatments: async () => {
        const response = await apiClient.get('/research/treatments');
        return response.data;
    },

    getDemographics: async () => {
        const response = await apiClient.get('/research/demographics');
        return response.data;
    },

    // Researcher Profile
    getProfile: async () => {
        const response = await apiClient.get('/research/profile');
        return response.data;
    },

    updateProfile: async (profileData) => {
        const response = await apiClient.put('/research/profile', profileData);
        return response.data;
    }
};
