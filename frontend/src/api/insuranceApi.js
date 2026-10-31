import apiClient from './client';

const insuranceApi = {
    getDashboardStats: async () => {
        const res = await apiClient.get('/insurance/dashboard');
        return res.data;
    },

    getClaims: async () => {
        const res = await apiClient.get('/insurance/claims');
        return res.data;
    },

    updateClaim: async (id, payload) => {
        const res = await apiClient.put(`/insurance/claims/${id}`, payload);
        return res.data;
    },

    verifyCoverage: async (params) => {
        const res = await apiClient.get('/insurance/coverage/verify', { params });
        return res.data;
    },

    getPolicyholders: async () => {
        const res = await apiClient.get('/insurance/policyholders');
        return res.data;
    },

    getProfile: async () => {
        const res = await apiClient.get('/insurance/profile');
        return res.data;
    },

    updateProfile: async (data) => {
        const res = await apiClient.put('/insurance/profile', data);
        return res.data;
    },
};

export default insuranceApi;
