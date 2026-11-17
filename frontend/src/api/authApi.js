import apiClient from './client';
import { getAuthHeader } from '../utils/tokenManager';
import { serializeSessionTransition } from '../utils/sessionBinding';

const publicConfig = (challengeToken, headers = {}) => {
    headers = { ...getAuthHeader(), ...headers };
    if (challengeToken) headers['X-Bot-Token'] = challengeToken;
    return Object.keys(headers).length ? { headers, skipAuth: true } : { skipAuth: true };
};

// Auth API functions
export const authApi = {
    // Patient registration
    registerPatient: async (data, { challengeToken, authenticated = false } = {}) => {
        const response = await apiClient.post('/auth/register/patient', data, { ...publicConfig(challengeToken, authenticated ? {} : {'X-Registration-Context':'public'}), ...(authenticated ? {sessionBound:true} : {}) });
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
    logout: (verifier = getAuthHeader()['X-CSRF-Token'] || '') => serializeSessionTransition(async () => {
        if(verifier && verifier !== getAuthHeader()['X-CSRF-Token']) return {success:true, superseded:true};
        const response = await apiClient.post('/auth/logout', undefined, { headers: getAuthHeader(), skipAuth: true });
        return response.data;
    }),
    // Verify Token
    verify: async () => {
        const response = await apiClient.get('/auth/verify', { skipUnauthorizedRedirect: true, sessionBootstrap:true });
        return response.data;
    },

    // ---- Passkey (WebAuthn) APIs ----

    // Generate passkey registration options (requires auth)
    passkeyRegisterOptions: async (stepUpTicket) => {
        const response = await apiClient.post('/auth/passkey/register/options', {}, { headers: { 'X-MFA-Step-Up': stepUpTicket }, skipUnauthorizedRedirect: true });
        return response.data;
    },

    // Verify passkey registration (requires auth)
    passkeyRegisterVerify: async (credential, credentialName, challengeId) => {
        const response = await apiClient.post('/auth/passkey/register/verify', { credential, credentialName, challengeId }, { skipUnauthorizedRedirect: true });
        return response.data;
    },

    // Generate passkey login options (public)
    passkeyLoginOptions: async (email) => {
        const response = await apiClient.post('/auth/passkey/login/options', { email }, { skipAuth: true });
        return response.data;
    },

    // Verify passkey login (public)
    passkeyLoginVerify: (email, credential, challengeId) => serializeSessionTransition(async () => {
        const response = await apiClient.post('/auth/passkey/login/verify', { email, credential, challengeId }, { skipAuth: true });
        return response.data;
    }),
    mfaStartSetup: async (ticket) => (await apiClient.post('/auth/mfa/setup', {}, { skipAuth: true, headers: { 'X-Auth-Challenge': ticket } })).data,
    mfaConfirmSetup: async (ticket, code) => (await apiClient.post('/auth/mfa/setup/confirm', { code }, { skipAuth: true, headers: { 'X-Auth-Challenge': ticket } })).data,
    mfaAcknowledgeSetup: (ticket) => serializeSessionTransition(async () => (await apiClient.post('/auth/mfa/setup/acknowledge', {}, { skipAuth: true, headers: { 'X-Auth-Challenge': ticket } })).data),
    mfaVerify: (ticket, code) => serializeSessionTransition(async () => (await apiClient.post('/auth/mfa/verify', { code }, { skipAuth: true, headers: { 'X-Auth-Challenge': ticket } })).data),
    mfaRecover: async (ticket, code) => (await apiClient.post('/auth/mfa/recover', { code }, { skipAuth: true, headers: { 'X-Auth-Challenge': ticket } })).data,
    mfaStepUp: async (code) => (await apiClient.post('/auth/mfa/step-up', { code }, { skipUnauthorizedRedirect: true })).data,
    passkeyStepUpOptions: async () => (await apiClient.post('/auth/passkey/step-up/options', {}, { skipUnauthorizedRedirect: true })).data,
    passkeyStepUpVerify: async (credential, challengeId) => (await apiClient.post('/auth/passkey/step-up/verify', { credential, challengeId }, { skipUnauthorizedRedirect: true })).data,
};

export default apiClient;
