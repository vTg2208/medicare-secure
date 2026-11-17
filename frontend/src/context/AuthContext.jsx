import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import { clearLegacyCredentials, getSignOutState, getSignOutVerifier, setSignOutState, getAuthHeader } from '../utils/tokenManager';
import { bindSession, unbindSession, hasSessionChanged, publishSessionChange, SESSION_EVENT_KEY, SESSION_SOURCE } from '../utils/sessionBinding';
import { authApi } from '../api/authApi';

export const AuthContext = createContext();
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState('');
    const generation = useRef(0);
    const identity = useRef(null);
    const revocation = useRef(null);
    const invalidatePending = useCallback(() => { generation.current++; }, []);

    const revokePendingLogout = useCallback(async () => {
        const ownerGeneration = generation.current;
        if (revocation.current?.generation === ownerGeneration) return revocation.current.promise;
        const verifier = getSignOutVerifier();
        const operation = (async () => {
            try {
                await authApi.logout(verifier);
                if (generation.current === ownerGeneration && getSignOutState() === 'pending') setSignOutState('signed-out', verifier);
                return true;
            } catch (error) {
                if (error.response?.status === 401) {
                    if (generation.current === ownerGeneration && getSignOutState() === 'pending') setSignOutState('signed-out', verifier);
                    return true;
                }
                return false;
            }
        })();
        revocation.current = { generation: ownerGeneration, promise: operation };
        try { return await operation; } finally {
            if (revocation.current?.promise === operation) revocation.current = null;
        }
    }, []);

    const verifySession = useCallback(async () => {
        const expected = ++generation.current;
        unbindSession(); identity.current = null;
        setUser(null); setLoading(true);
        clearLegacyCredentials();
        const signedOut = getSignOutState();
        if (signedOut === 'pending') await revokePendingLogout();
        else if (!signedOut) {
            try {
                const response = await authApi.verify();
                if (generation.current === expected && response.success && response.user) {
                    identity.current = response.user; bindSession(); setUser(response.user); setAuthError('');
                }
            } catch (error) {
                if (generation.current === expected && error.response?.status !== 401 && error.code !== 'ERR_SESSION_CHANGED') {
                    setAuthError('Unable to verify your session. Please retry when the service is available.');
                }
            }
        }
        if (generation.current === expected) setLoading(false);
    }, [revokePendingLogout]);

    useEffect(() => {
        const online = () => { if (getSignOutState() === 'pending') void revokePendingLogout(); };
        const reconcile = () => { if (hasSessionChanged()) void verifySession(); };
        const changed = event => {
            if (event.key === SESSION_EVENT_KEY) {
                try { if (JSON.parse(event.newValue)?.source === SESSION_SOURCE) return; } catch { /* Reverify on unknown signals. */ }
                void verifySession();
            } else if (event.key === 'medicare_sign_out_v1' && event.newValue) void verifySession();
        };
        let channel;
        if (typeof BroadcastChannel === 'function') {
            channel = new BroadcastChannel(SESSION_EVENT_KEY);
            channel.onmessage = event => { if (event.data?.source !== SESSION_SOURCE) void verifySession(); };
        }
        void verifySession();
        window.addEventListener('online', online); window.addEventListener('storage', changed);
        window.addEventListener('focus', reconcile); window.addEventListener('medicare:session-changed', reconcile);
        document.addEventListener('visibilitychange', reconcile);
        return () => {
            invalidatePending(); channel?.close();
            window.removeEventListener('online', online); window.removeEventListener('storage', changed);
            window.removeEventListener('focus', reconcile); window.removeEventListener('medicare:session-changed', reconcile);
            document.removeEventListener('visibilitychange', reconcile);
        };
    }, [revokePendingLogout, verifySession, invalidatePending]);

    const login = userData => {
        generation.current++;
        clearLegacyCredentials(); setSignOutState(null); bindSession();
        const confirmed = { ...userData, role: userData.role || userData.roleName };
        identity.current = confirmed; setUser(confirmed); publishSessionChange();
        setAuthError(''); setLoading(false);
    };
    const updateUser = (updates, expectedId) => {
        if (!identity.current || !expectedId || identity.current.id !== expectedId || getSignOutState() || hasSessionChanged()) return false;
        if (updates.id && updates.id !== expectedId) return false;
        const confirmed = { ...identity.current, ...updates, id: expectedId };
        identity.current = confirmed; setUser(confirmed); return true;
    };
    const logout = async () => {
        const expected = ++generation.current;
        const verifier = getAuthHeader()['X-CSRF-Token'] || '';
        clearLegacyCredentials(); setSignOutState('pending', verifier); unbindSession(); identity.current = null;
        setUser(null); setLoading(false); setAuthError('');
        const revoked = await revokePendingLogout();
        if (!revoked && generation.current === expected && getSignOutState() === 'pending') {
            setAuthError('Signed out on this device. Server sign-out will retry when you reconnect.');
        }
    };
    return <AuthContext.Provider value={{ user, login, updateUser, logout, loading, authError }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
