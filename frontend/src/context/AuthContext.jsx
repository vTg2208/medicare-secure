import React, { createContext, useState, useEffect, useContext } from 'react';
import { getToken, setToken, removeToken } from '../utils/tokenManager';
import { authApi } from '../api/authApi';

export const AuthContext = createContext();
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    useEffect(() => {
        let active = true;
        const initAuth = async () => {
            if (getToken()) {
                try {
                    const response = await authApi.verify();
                    if (active) {
                        if (response.success && response.user) setUser(response.user);
                        else { removeToken(); setUser(null); }
                    }
                } catch (error) {
                    if (active) {
                        if (error.response?.status === 401) removeToken();
                        else setAuthError('Unable to verify your session. Please retry when the service is available.');
                    }
                }
            }
            if (active) setLoading(false);
        };
        initAuth();
        return () => { active = false; };
    }, []);
    const login = (userData, token) => {
        setUser({ ...userData, role: userData.role || userData.roleName });
        setAuthError('');
        setToken(token);
    };
    const logout = async () => {
        // Capture credentials before local clearing, even when callers navigate immediately.
        const request = getToken() ? authApi.logout() : Promise.resolve();
        setUser(null);
        setAuthError('');
        removeToken();
        try { await request; } catch { /* Local sign-out must work while offline. */ }
    };
    return <AuthContext.Provider value={{ user, login, logout, loading, authError }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
