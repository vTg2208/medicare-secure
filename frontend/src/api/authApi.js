import apiClient from './client';
import { getAuthHeader } from '../utils/tokenManager';

const publicConfig = (challengeToken, headers = {}) => {
    if (challengeToken) headers['X-Bot-Token'] = challengeToken;
    return Object.keys(headers).length ? { headers, skipAuth: true } : { skipAuth: true };
};

// Auth API functions
export const authApi = {
    // Patient registration
    registerPatient: async (data, { challengeToken, authenticated = false } = {}) => {
        const response = await apiClient.post('/auth/register/patient', data, publicConfig(challengeToken, authenticated ? getAuthHeader() : {}));
        return response.data;
    },
    // Doctor registration
    registerDoctor: async (data, challengeToken) => {
        const response = await apiClient.post('/auth/register/doctor', data, publicConfig(challengeToken, { 'Content-Type': 'multipart/form-data' }));
        return response.data;
    },
    // Organization registration
    registerOrganization: async (data, challengeToken) => {
        const response = await apiClient.post('/auth/register/organization', data, publicConfig(challengeToken, { 'Content-Type': 'multipart/form-data' }));
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
    resendOTP: async (email, challengeToken) => {
        const response = await apiClient.post('/auth/resend-otp', { email }, publicConfig(challengeToken));
        return response.data;
    },

    // Login
    login: async (email, password, challengeToken) => {
        const response = await apiClient.post('/auth/login', { emailOrPhone: email, password }, publicConfig(challengeToken));
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
