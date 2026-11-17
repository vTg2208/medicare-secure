import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authApi } from '../api/authApi';
import { getSignOutState, setSignOutState } from '../utils/tokenManager';

vi.mock('../api/authApi', () => ({ authApi: { verify: vi.fn(), logout: vi.fn() } }));
let currentSession;
function Session() {
    currentSession=useAuth();
    const { user, loading, login, logout } = currentSession;
    return <><p>{loading ? 'Checking session' : user?.role || 'Guest'}</p>
        <button onClick={() => login({ role: 'patient' }, 'must-never-persist')}>Finish sign in</button>
        <button onClick={logout}>Sign out</button><output data-testid="identity">{user?.id || ''}</output></>;
}
beforeEach(() => {
    localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
    document.cookie='medicare_csrf=fixture-session; Path=/';setSignOutState(null);
    authApi.verify.mockResolvedValue({ success: false });
    authApi.logout.mockResolvedValue({ success: true });
});
test('restores only a server-verified cookie session without a stored bearer token', async () => {
    authApi.verify.mockResolvedValue({ success: true, user: { role: 'doctor' } });
    render(<AuthProvider><Session /></AuthProvider>);
    expect(await screen.findByText('doctor')).toBeInTheDocument();
    expect(localStorage.getItem('healthcare_token')).toBeNull();
});
test('sign-in removes legacy credentials and never persists returned bearer values', async () => {
    localStorage.setItem('healthcare_token', 'legacy-private-token');
    render(<AuthProvider><Session /></AuthProvider>);
    await waitFor(() => expect(screen.queryByText('Checking session')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Finish sign in'));
    expect(screen.getByText('patient')).toBeInTheDocument();
    expect(localStorage.getItem('healthcare_token')).toBeNull();
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('must-never-persist');
});
test('an earlier session check cannot overwrite a newly completed login', async () => {
    localStorage.setItem('healthcare_token', 'legacy-session');
    let resolve;
    authApi.verify.mockReturnValue(new Promise(done => { resolve = done; }));
    render(<AuthProvider><Session /></AuthProvider>);
    fireEvent.click(screen.getByText('Finish sign in'));
    await act(async () => resolve?.({ success: false }));
    expect(screen.getByText('patient')).toBeInTheDocument();
});
test('offline logout stays signed out across reload and retries revocation when online', async () => {
    authApi.verify.mockResolvedValue({ success: true, user: { role: 'doctor' } });
    authApi.logout.mockRejectedValue(new Error('offline'));
    const page = render(<AuthProvider><Session /></AuthProvider>);
    expect(await screen.findByText('doctor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(authApi.logout).toHaveBeenCalledOnce());
    expect(screen.getByText('Guest')).toBeInTheDocument();
    page.unmount();
    authApi.verify.mockClear();
    render(<AuthProvider><Session /></AuthProvider>);
    expect(await screen.findByText('Guest')).toBeInTheDocument();
    expect(authApi.verify).not.toHaveBeenCalled();
    authApi.logout.mockResolvedValue({ success: true });
    const attempts = authApi.logout.mock.calls.length;
    await act(async () => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(authApi.logout.mock.calls.length).toBeGreaterThan(attempts));
});
test('a new login has its own logout operation while an earlier logout is still in flight', async () => {
    const finishes = [];
    authApi.verify.mockResolvedValue({ success: true, user: { role: 'doctor' } });
    authApi.logout.mockImplementation(() => new Promise(resolve => finishes.push(resolve)));
    render(<AuthProvider><Session /></AuthProvider>);
    expect(await screen.findByText('doctor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sign out'));
    fireEvent.click(screen.getByText('Finish sign in'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(authApi.logout).toHaveBeenCalledTimes(2);
    await act(async () => finishes[0]({ success: true }));
    expect(getSignOutState()).toBe('pending');
    await act(async () => finishes[1]({ success: true }));
    expect(getSignOutState()).toBe('signed-out');
});

test('another tab signing in clears the previous account UI before re-verifying the shared cookie',async()=>{
    let finish;
    authApi.verify.mockResolvedValueOnce({success:true,user:{id:'account-a',role:'doctor'}})
        .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    render(<AuthProvider><Session/></AuthProvider>);
    expect(await screen.findByText('doctor')).toBeInTheDocument();
    document.cookie='medicare_csrf=account-b-cookie; Path=/';
    await act(async()=>window.dispatchEvent(new StorageEvent('storage',{key:'medicare_session_event_v1',newValue:JSON.stringify({source:'another-tab'})})));
    await waitFor(()=>expect(authApi.verify).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Checking session')).toBeInTheDocument();expect(screen.getByTestId('identity')).toBeEmptyDOMElement();
    await act(async()=>finish({success:true,user:{id:'account-b',role:'patient'}}));
    expect(screen.getByTestId('identity')).toHaveTextContent('account-b');
});

test('a delayed profile save cannot clear offline logout or restore the earlier identity',async()=>{
    authApi.verify.mockResolvedValue({success:true,user:{id:'account-a',role:'doctor'}});
    authApi.logout.mockRejectedValue(Error('offline'));
    render(<AuthProvider><Session/></AuthProvider>);await screen.findByText('doctor');
    expect(currentSession.updateUser).toBeTypeOf('function');
    fireEvent.click(screen.getByText('Sign out'));
    await act(async()=>expect(currentSession.updateUser({firstName:'Old response'},'account-a')).toBe(false));
    expect(screen.getByText('Guest')).toBeInTheDocument();expect(getSignOutState()).toBe('pending');
});
