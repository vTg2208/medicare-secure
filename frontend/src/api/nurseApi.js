import apiClient from './client';

export const nurseApi = {
    // Get dashboard statistics for the nurse
    getDashboardStats: async () => {
        const response = await apiClient.get('/nurse/stats');
        return response.data;
    },
    // Get assigned patients for the nurse
    getAssignedPatients: async () => {
        const response = await apiClient.get('/nurse/assigned-patients');
        return response.data;
    },
    // Get recent activities for the nurse
    getActivities: async () => {
        const response = await apiClient.get('/nurse/activities');
        return response.data;
    },
    // Get records specifically for the nurse's patient
    getPatientRecords: async (patientId) => {
        const response = await apiClient.get(`/nurse/patients/${patientId}/records`);
        return response.data;
    },
    // Add a new record specifically by the nurse
    addPatientRecord: async (patientId, recordData) => {
        const response = await apiClient.post(`/nurse/patients/${patientId}/records`, recordData);
        return response.data;
    },
    // Get shift medications
    getMedications: async () => {
        const response = await apiClient.get('/nurse/medications');
        return response.data;
    },
    // Update medication administration status
    updateMedicationStatus: async (medicationId, payload) => {
        const response = await apiClient.put(`/nurse/medications/${medicationId}/status`, payload);
        return response.data;
    },
    // Get nurse profile
    getProfile: async () => {
        const response = await apiClient.get('/nurse/profile');
        return response.data;
    },
    // Update nurse profile
    updateProfile: async (payload) => {
        const response = await apiClient.put('/nurse/profile', payload);
        return response.data;
    },
    // Get clinical vitals
    getVitals: async () => {
        const response = await apiClient.get('/nurse/vitals');
        return response.data;
    },
    // Get shift schedule
    getSchedule: async () => {
        const response = await apiClient.get('/nurse/schedule');
        return response.data;
    }
};

export default nurseApi;
