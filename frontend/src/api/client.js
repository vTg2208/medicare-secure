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
// Share only pending JSON reads. Completed responses (including patient data)
// are never cached, and mutations create a new generation of reads.
let readGeneration = 0;
const adapters = new WeakMap();
function deduplicateAdapter(adapter) {
    if (adapters.has(adapter)) return adapters.get(adapter);
    const pending = new Map();
    const wrapped = config => {
        const key = JSON.stringify([readGeneration, apiClient.getUri(config), config.timeout,
            Object.entries(config.headers.toJSON()).sort(([a], [b]) => a.localeCompare(b))]);
        if (!pending.has(key)) {
            const request = Promise.resolve().then(() => adapter(config)).finally(() => pending.delete(key));
            pending.set(key, request);
        }
        return pending.get(key).then(response => ({ ...response, config }));
    };
    adapters.set(adapter, wrapped);
    return wrapped;
}
apiClient.interceptors.request.use((config) => {
    if (!config.skipAuth) Object.assign(config.headers, getAuthHeader());
    const isRead = ['get', 'head', 'options'].includes(config.method);
    if (!isRead) readGeneration++;
    // A caller with cancellation owns its transport; sharing would let one
    // component abort a request another component still needs.
    if (config.method === 'get' && !config.signal && !config.cancelToken && config.dedupe !== false &&
        (!config.responseType || config.responseType === 'json')) {
        config.adapter = deduplicateAdapter(axios.getAdapter(config.adapter));
    }
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
const invalidateAfterWrite = config => {
    if (config && !['get', 'head', 'options'].includes(config.method)) readGeneration++;
};
apiClient.interceptors.response.use((response) => {
    invalidateAfterWrite(response.config);
    return response;
}, error => {
    invalidateAfterWrite(error.config);
    return handleUnauthorized(error);
});
export default apiClient;
