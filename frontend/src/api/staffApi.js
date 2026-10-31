import apiClient from './client';

// Staff API functions
export const staffApi = {
    // ============================================================================
    // Invitation Management (Admin only)
    // ============================================================================

    // Check if email exists
    checkEmail: async (email) => {
        const response = await apiClient.get(`/staff/check-email?email=${encodeURIComponent(email)}`);
        return response.data;
    },

    // Invite a new staff member
    inviteStaff: async (data) => {
        const response = await apiClient.post('/staff/invite', data);
        return response.data;
    },

    // Get all invitations
    getInvitations: async () => {
        const response = await apiClient.get('/staff/invitations');
        return response.data;
    },

    // Resend invitation
    resendInvitation: async (invitationId) => {
        const response = await apiClient.post(`/staff/invitations/${invitationId}/resend`);
        return response.data;
    },

    // Cancel invitation
    cancelInvitation: async (invitationId) => {
        const response = await apiClient.delete(`/staff/invitations/${invitationId}`);
        return response.data;
    },

    // Get invitation statistics
    getInvitationStats: async () => {
        const response = await apiClient.get('/staff/invitations/stats');
        return response.data;
    },

    // ============================================================================
    // Public Invitation Endpoints (No authentication required)
    // ============================================================================

    // Validate invitation token
    validateInvitation: async (token) => {
        const response = await apiClient.get(`/staff/invitations/${token}/validate`, { skipAuth: true });
        return response.data;
    },

    // Accept invitation and create account
    acceptInvitation: async (token, data) => {
        const response = await apiClient.post(`/staff/invitations/${token}/accept`, data, { skipAuth: true });
        return response.data;
    },

    // ============================================================================
    // Account Management (Admin only)
    // ============================================================================

    // Suspend staff account
    suspendAccount: async (userId, reason) => {
        const response = await apiClient.post(`/staff/accounts/${userId}/suspend`, { reason });
        return response.data;
    },

    // Activate staff account
    activateAccount: async (userId) => {
        const response = await apiClient.post(`/staff/accounts/${userId}/activate`);
        return response.data;
    },

    // Get suspended accounts
    getSuspendedAccounts: async () => {
        const response = await apiClient.get('/staff/accounts/suspended');
        return response.data;
    },

    // Get account status
    getAccountStatus: async (userId) => {
        const response = await apiClient.get(`/staff/accounts/${userId}/status`);
        return response.data;
    },

    // Get account statistics
    getAccountStats: async () => {
        const response = await apiClient.get('/staff/accounts/stats');
        return response.data;
    },

    // Get account history
    getAccountHistory: async (userId) => {
        const response = await apiClient.get(`/staff/accounts/${userId}/history`);
        return response.data;
    },

    // ============================================================================
    // Audit Trail (Admin only)
    // ============================================================================

    // Get recent actions
    getRecentActions: async () => {
        const response = await apiClient.get('/staff/actions/recent');
        return response.data;
    },
};

export default staffApi;
