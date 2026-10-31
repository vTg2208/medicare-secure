import { AxiosHeaders } from 'axios';
import apiClient, { handleUnauthorized, normalizeApiUrl, normalizeApiTimeout } from './client';
import { authApi } from './authApi';
import { getToken, setToken } from '../utils/tokenManager';

beforeEach(() => localStorage.clear());
test.each([
    [undefined, 15000], ['', 15000], [' ', 15000], ['invalid', 15000],
    ['Infinity', 15000], ['0', 15000], ['999', 15000], ['120001', 15000],
    ['15000.5', 15000], ['1000', 1000], ['90000', 90000], ['120000', 120000],
])('validates API timeout setting %s', (value, expected) => expect(normalizeApiTimeout(value)).toBe(expected));

test.each([
    [undefined, '/api'], ['', '/api'], ['/api/', '/api'],
    ['https://example.test/', 'https://example.test/api'],
    ['https://example.test/api/', 'https://example.test/api'],
    ['https://example.test/api/v1', 'https://example.test/api/v1'],
])('normalizes API setting %s', (value, expected) => expect(normalizeApiUrl(value)).toBe(expected));

test('bounds requests and authenticates protected calls', async () => {
    setToken('session');
    const adapter = vi.fn(async (config) => ({ data: {}, status: 200, headers: {}, config }));
    await apiClient.get('/patients/me', { adapter });
    const config = adapter.mock.calls[0][0];
    expect(config.timeout).toBe(15000);
    expect(config.headers.Authorization).toBe('Bearer session');
});

test('public login does not attach an existing token', async () => {
    setToken('old-session');
    const original = apiClient.defaults.adapter;
    const request = vi.fn(async (config) => ({ data: { success: false }, status: 200, headers: {}, config }));
    apiClient.defaults.adapter = request;
    try {
        await authApi.login('patient@example.test', 'invalid');
        expect(request.mock.calls[0][0].headers.Authorization).toBeUndefined();
        expect(request.mock.calls[0][0].skipAuth).toBe(true);
    } finally { apiClient.defaults.adapter = original; }
});

test.each([true, false])('redirects only authenticated protected 401s (public=%s)', async (skipAuth) => {
    setToken('session');
    const redirect = vi.fn();
    const error = { response: { status: 401 }, config: { skipAuth, headers: new AxiosHeaders({ Authorization: 'Bearer session' }) } };
    await expect(handleUnauthorized(error, redirect)).rejects.toBe(error);
    expect(redirect).toHaveBeenCalledTimes(skipAuth ? 0 : 1);
    expect(getToken()).toBe(skipAuth ? 'session' : null);
});

test('handles transport errors and unauthenticated 401 without redirect', async () => {
    const redirect = vi.fn();
    for (const error of [{}, { response: { status: 401 }, config: { headers: {} } }]) {
        await expect(handleUnauthorized(error, redirect)).rejects.toBe(error);
    }
    expect(redirect).not.toHaveBeenCalled();
});
