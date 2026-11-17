import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import PasskeySetupCard from './PasskeySetupCard';

vi.mock('../../api/authApi', () => ({ authApi: { mfaStepUp: vi.fn(), passkeyStepUpOptions: vi.fn(), passkeyStepUpVerify: vi.fn(), passkeyRegisterOptions: vi.fn(), passkeyRegisterVerify: vi.fn() } }));
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn(), startAuthentication: vi.fn() }));
beforeEach(() => {
    vi.clearAllMocks();
    authApi.mfaStepUp.mockResolvedValue({ data: { stepUpTicket: 'fresh-factor-proof' } });
    authApi.passkeyRegisterOptions.mockResolvedValue({ success: true, data: { challenge: 'registration', challengeId: 'registration-ticket' } });
    authApi.passkeyRegisterVerify.mockResolvedValue({ success: true });
    startRegistration.mockResolvedValue({ id: 'new-credential' });
});
test('requires a fresh authenticator proof before registering a passkey', async () => {
    render(<AuthContext.Provider value={{ user: { role: 'patient' } }}><PasskeySetupCard /></AuthContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Set Up Passkey' }));
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Register Passkey' }));
    expect(await screen.findByText(/Passkey registered!/)).toBeInTheDocument();
    expect(authApi.mfaStepUp).toHaveBeenCalledWith('123456');
    expect(authApi.passkeyRegisterOptions).toHaveBeenCalledWith('fresh-factor-proof');
    expect(authApi.passkeyRegisterVerify).toHaveBeenCalledWith({ id: 'new-credential' }, 'My Passkey', 'registration-ticket');
});
test('allows an existing verified passkey to authorize another passkey', async () => {
    authApi.passkeyStepUpOptions.mockResolvedValue({ data: { challenge: 'stepup', challengeId: 'stepup-ticket' } });
    authApi.passkeyStepUpVerify.mockResolvedValue({ data: { stepUpTicket: 'passkey-factor-proof' } });
    startAuthentication.mockResolvedValue({ id: 'existing-credential' });
    render(<AuthContext.Provider value={{ user: { role: 'patient' } }}><PasskeySetupCard /></AuthContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Set Up Passkey' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Existing passkey' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Register Passkey' }));
    expect(await screen.findByText(/Passkey registered!/)).toBeInTheDocument();
    expect(authApi.passkeyStepUpVerify).toHaveBeenCalledWith({ id: 'existing-credential' }, 'stepup-ticket');
    expect(authApi.passkeyRegisterOptions).toHaveBeenCalledWith('passkey-factor-proof');
});
