const TOKEN_KEY = 'healthcare_token';
export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
export function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}
export function getAuthHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}