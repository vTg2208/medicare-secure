import axios from 'axios';
import { getAuthHeader, removeToken } from '../utils/tokenManager';

// Accept both an origin and an API URL. Use the same-origin production proxy by default.
export function normalizeApiUrl(value = '') {
    const base = value.trim().replace(/\/+$/, '');
    if (!base) return '/api';
    return /\/api(?:\/v\d+)?$/.test(base) ? base : `${base}/api`;
}
export const API_BASE_URL = normalizeApiUrl(process.env.REACT_APP_API_URL);
export function normalizeApiTimeout(value) {
    const timeout = Number(value);
    return Number.isInteger(timeout) && timeout >= 1000 && timeout <= 120000 ? timeout : 15000;
}
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: normalizeApiTimeout(process.env.REACT_APP_API_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json' },
});
apiClient.interceptors.request.use((config) => {
    if (!config.skipAuth) Object.assign(config.headers, getAuthHeader());
    return config;
});
export function handleUnauthorized(error, redirect = () => window.location.assign('/login')) {
    // Public login, OTP, invitation and passkey failures belong to their forms.
    const config = error.config;
    if (error.response?.status === 401 && config && !config.skipAuth && config.headers?.Authorization) {
        removeToken();
        redirect();
    }
    return Promise.reject(error);
}
apiClient.interceptors.response.use((response) => response, handleUnauthorized);
export default apiClient;
