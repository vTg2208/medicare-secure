import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../api/authApi';
import { setSignOutState } from '../utils/tokenManager';

vi.mock('../api/authApi', () => ({ authApi: { verify: vi.fn(), logout: vi.fn() } }));
function Consumer() {
    const { user, loading, authError, login, logout } = useAuth();
    return <><span>{loading ? 'checking' : user?.role || 'guest'}</span><span>{authError}</span>
        <button onClick={() => login({ roleName: 'patient' }, 'session')}>Login</button>
        <button onClick={logout}>Logout</button></>;
}
beforeEach(() => { localStorage.clear(); setSignOutState(null); vi.clearAllMocks(); authApi.verify.mockResolvedValue({ success: false }); });
test('normalizes a login and revokes the session before local logout completes', async () => {
    authApi.logout.mockResolvedValue({ success: true });
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('patient')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledOnce());
    expect(localStorage.getItem('healthcare_token')).toBeNull();
    expect(screen.getByText('guest')).toBeInTheDocument();
});
test('restores a server-verified session', async () => {
    authApi.verify.mockResolvedValue({ success: true, user: { role: 'doctor' } });
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText('doctor')).toBeInTheDocument();
});
test('keeps protected UI hidden and shows an actionable error during outage', async () => {
    localStorage.setItem('healthcare_token', 'legacy-token');
    authApi.verify.mockRejectedValue(new Error('offline'));
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText(/Unable to verify/)).toBeInTheDocument();
    expect(localStorage.getItem('healthcare_token')).toBeNull();
    expect(screen.getByText('guest')).toBeInTheDocument();
});
