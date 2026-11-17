import apiClient from './client';
import { authApi } from './authApi';

afterEach(() => { localStorage.clear(); document.cookie = 'medicare_csrf=; Max-Age=0; Path=/'; vi.restoreAllMocks(); });

test('public auth sends the bot challenge only in its header and never attaches a legacy bearer', async () => {
    localStorage.setItem('healthcare_token', 'existing-session');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    await authApi.login('patient@example.test', 'password', 'login-token');
    expect(post).toHaveBeenLastCalledWith('/auth/login', { emailOrPhone: 'patient@example.test', password: 'password' }, { skipAuth: true, headers: { 'X-Bot-Token': 'login-token' } });
    await authApi.registerPatient({ name: 'Patient' }, { challengeToken: 'patient-token' });
    expect(post).toHaveBeenLastCalledWith('/auth/register/patient', { name: 'Patient' }, { skipAuth: true, headers: { 'X-Bot-Token': 'patient-token', 'X-Registration-Context':'public' } });
    const data = new FormData();
    for (const method of ['registerDoctor', 'registerOrganization']) {
        await authApi[method](data, 'upload-token');
        expect(post.mock.lastCall[2]).toEqual({ skipAuth: true, headers: { 'Content-Type': 'multipart/form-data', 'X-Bot-Token': 'upload-token' } });
    }
    await authApi.resendOTP('patient@example.test', 'resend-token');
    expect(post).toHaveBeenLastCalledWith('/auth/resend-otp', { email: 'patient@example.test' }, { skipAuth: true, headers: { 'X-Bot-Token': 'resend-token' } });
});

test('staff patient registration attaches session-bound CSRF while retaining public error handling', async () => {
    document.cookie = 'medicare_csrf=staff-verifier; Path=/';
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
    await authApi.registerPatient({ name: 'Patient' }, { authenticated: true });
    expect(post).toHaveBeenCalledWith('/auth/register/patient', { name: 'Patient' }, { skipAuth: true, sessionBound:true, headers: { 'X-CSRF-Token': 'staff-verifier' } });
});

test('restricted MFA tickets stay in their dedicated header and passkey assertions keep their challenge identity', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    await authApi.mfaVerify('restricted-ticket', '123456');
    expect(post).toHaveBeenLastCalledWith('/auth/mfa/verify', { code: '123456' }, { skipAuth: true, headers: { 'X-Auth-Challenge': 'restricted-ticket' } });
    await authApi.passkeyLoginVerify('patient@example.test', { id: 'credential' }, 'challenge-ticket');
    expect(post).toHaveBeenLastCalledWith('/auth/passkey/login/verify', { email: 'patient@example.test', credential: { id: 'credential' }, challengeId: 'challenge-ticket' }, { skipAuth: true });
});
