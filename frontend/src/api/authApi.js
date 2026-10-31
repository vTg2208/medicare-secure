import apiClient from './client';
import { getAuthHeader } from '../utils/tokenManager';

// Auth API functions
export const authApi = {
    // Patient registration
    registerPatient: async (data) => {
        const response = await apiClient.post('/auth/register/patient', data, { skipAuth: true });
        return response.data;
    },
    // Doctor registration
    registerDoctor: async (data) => {
        const response = await apiClient.post('/auth/register/doctor', data, {
            headers: { 'Content-Type': 'multipart/form-data' }, skipAuth: true,
        });
        return response.data;
    },
    // Organization registration
    registerOrganization: async (data) => {
        const response = await apiClient.post('/auth/register/organization', data, {
            headers: { 'Content-Type': 'multipart/form-data' }, skipAuth: true,
        });
        return response.data;
    },
    // Verify OTP
    verifyOTP: async (emailOrPhone, otp, purpose = 'registration') => {
        const payload = { otp, purpose };
        if (emailOrPhone.includes('@')) {
            payload.email = emailOrPhone;
        } else {
            payload.phone = emailOrPhone;
        }
        const response = await apiClient.post('/auth/otp/verify', payload, { skipAuth: true });
        return response.data;
    },
    // Resend registration OTP
    resendOTP: async (email) => {
        const response = await apiClient.post('/auth/resend-otp', { email }, { skipAuth: true });
        return response.data;
    },

    // Login
    login: async (email, password) => {
        const response = await apiClient.post('/auth/login', { emailOrPhone: email, password }, { skipAuth: true });
        return response.data;
    },
    // Logout
    logout: async () => {
        const response = await apiClient.post('/auth/logout', undefined, { headers: getAuthHeader(), skipAuth: true });
        return response.data;
    },
    // Verify Token
    verify: async () => {
        const response = await apiClient.get('/auth/verify');
        return response.data;
    },

    // ---- Passkey (WebAuthn) APIs ----

    // Generate passkey registration options (requires auth)
    passkeyRegisterOptions: async (token) => {
        const config = token ? { headers: { Authorization: `Bearer ${token}` }, skipAuth: true } : undefined;
        const response = await apiClient.post('/auth/passkey/register/options', undefined, config);
        return response.data;
    },

    // Verify passkey registration (requires auth)
    passkeyRegisterVerify: async (credential, credentialName, token) => {
        const config = token ? { headers: { Authorization: `Bearer ${token}` }, skipAuth: true } : undefined;
        const response = await apiClient.post('/auth/passkey/register/verify', { credential, credentialName }, config);
        return response.data;
    },

    // Generate passkey login options (public)
    passkeyLoginOptions: async (email) => {
        const response = await apiClient.post('/auth/passkey/login/options', { email }, { skipAuth: true });
        return response.data;
    },

    // Verify passkey login (public)
    passkeyLoginVerify: async (email, credential) => {
        const response = await apiClient.post('/auth/passkey/login/verify', { email, credential }, { skipAuth: true });
        return response.data;
    },
};

export default apiClient;
