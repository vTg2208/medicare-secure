// Emergency Access API Integration
import apiClient from './client';

export const emergencyApi = {
    // Activate Emergency Mode
    activate: async (justification) => {
        const response = await apiClient.post('/emergency/activate', { justification });
        return response.data;
    },

    // Deactivate Emergency Mode
    deactivate: async () => {
        const response = await apiClient.post('/emergency/deactivate', {});
        return response.data;
    },

    // Get Emergency Status
    getStatus: async () => {
        const response = await apiClient.get('/emergency/status');
        return response.data;
    },

    // Get Emergency Access History
    getHistory: async () => {
        const response = await apiClient.get('/emergency/history');
        return response.data;
    },
};

