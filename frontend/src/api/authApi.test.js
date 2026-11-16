import apiClient from './client';
import { authApi } from './authApi';
import { setToken } from '../utils/tokenManager';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

test('public auth sends a challenge token only in its header and does not attach the session', async () => {
    setToken('existing-session');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });
    await authApi.login('patient@example.test', 'password', 'login-token');
    expect(post).toHaveBeenLastCalledWith('/auth/login', { emailOrPhone: 'patient@example.test', password: 'password' }, { skipAuth: true, headers: { 'X-Bot-Token': 'login-token' } });
    await authApi.registerPatient({ name: 'Patient' }, { challengeToken: 'patient-token' });
    expect(post).toHaveBeenLastCalledWith('/auth/register/patient', { name: 'Patient' }, { skipAuth: true, headers: { 'X-Bot-Token': 'patient-token' } });
    const data = new FormData();
    for (const method of ['registerDoctor', 'registerOrganization']) {
        await authApi[method](data, 'upload-token');
        expect(post.mock.lastCall[2]).toEqual({ skipAuth: true, headers: { 'Content-Type': 'multipart/form-data', 'X-Bot-Token': 'upload-token' } });
    }
    await authApi.resendOTP('patient@example.test', 'resend-token');
    expect(post).toHaveBeenLastCalledWith('/auth/resend-otp', { email: 'patient@example.test' }, { skipAuth: true, headers: { 'X-Bot-Token': 'resend-token' } });
});

test('staff patient registration explicitly attaches its session while retaining public error handling', async () => {
    setToken('staff-session');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: {} });
    await authApi.registerPatient({ name: 'Patient' }, { authenticated: true });
    expect(post).toHaveBeenCalledWith('/auth/register/patient', { name: 'Patient' }, { skipAuth: true, headers: { Authorization: 'Bearer staff-session' } });
});
