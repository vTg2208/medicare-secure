import apiClient from './client';

export const doctorApi = {
    // Get all pending verifications (admin only)
    getPendingVerifications: async () => {
        const response = await apiClient.get('/doctors/verification/pending');
        return response.data;
    },

    // Approve doctor verification (admin only)
    approveDoctor: async (userId, notes) => {
        const response = await apiClient.post(`/doctors/verification/${userId}/approve`, { notes });
        return response.data;
    },

    // Reject doctor verification (admin only)
    rejectDoctor: async (userId, reason) => {
        const response = await apiClient.post(`/doctors/verification/${userId}/reject`, { reason });
        return response.data;
    },

    // Get verification stats (admin only)
    getVerificationStats: async () => {
        const response = await apiClient.get('/doctors/verification/stats');
        return response.data;
    },

    // Get own verification status (doctor only)
    getVerificationStatus: async () => {
        const response = await apiClient.get('/doctors/verification/status');
        return response.data;
    },

    // Submit for verification (doctor only)
    submitForVerification: async () => {
        const response = await apiClient.post('/doctors/verification/submit');
        return response.data;
    }
};

export default doctorApi;
