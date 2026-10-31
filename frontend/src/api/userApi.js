import apiClient from './client';

export const userApi = {
    // Get all users (with optional role filter)
    getAllUsers: async (role = null) => {
        const params = role ? { role } : {};
        const response = await apiClient.get('/users', { params });
        return response.data;
    },

    // Get doctors
    getDoctors: async () => {
        const response = await apiClient.get('/users/doctors');
        return response.data;
    },

    // Get nurses
    getNurses: async () => {
        const response = await apiClient.get('/users/nurses');
        return response.data;
    },

    // Onboard staff
    onboardStaff: async (data) => {
        const response = await apiClient.post('/users/staff/onboard', data);
        return response.data;
    },
    // Deactivate staff
    deactivateStaff: async (userId) => {
        const response = await apiClient.put('/users/staff/deactivate', { userId });
        return response.data;
    },

    // Get current user profile
    getProfile: async () => {
        const response = await apiClient.get('/users/profile');
        return response.data;
    },

    // Update current user profile
    updateProfile: async (profileData) => {
        const response = await apiClient.put('/users/profile', profileData);
        return response.data;
    }
};

export default userApi;

