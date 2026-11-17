import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { authApi } from '../../api/authApi';
import { startAuthentication } from '@simplewebauthn/browser';
import Login from './Login';

vi.mock('../../api/authApi', () => ({ authApi: { login: vi.fn(), passkeyLoginOptions: vi.fn(), passkeyLoginVerify: vi.fn(),
    mfaStartSetup: vi.fn(), mfaConfirmSetup: vi.fn(), mfaAcknowledgeSetup: vi.fn(), mfaVerify: vi.fn(), mfaRecover: vi.fn() } }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));

function setup() {
    const login = vi.fn();
    render(<MemoryRouter initialEntries={['/login']}><ThemeProvider><AuthContext.Provider value={{ login }}><Routes><Route path="/login" element={<Login />} /><Route path="/patient/dashboard" element={<h1>Patient dashboard</h1>} /></Routes></AuthContext.Provider></ThemeProvider></MemoryRouter>);
    return { user: userEvent.setup(), login };
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { delete window.turnstile; });

test('signs in through labelled fields and routes to the patient dashboard', async () => {
    authApi.login.mockResolvedValue({ data: { user: { role: 'PATIENT' } } });
    const { user, login } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@demo.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ role: 'PATIENT' });
    expect(authApi.login).toHaveBeenCalledWith('patient@demo.invalid', 'test-password');
});

test('announces failed authentication and permits another attempt', async () => {
    authApi.login.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    const { user } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@demo.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    await user.type(screen.getByLabelText('Password', { exact: true }), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('password verification waits for an authenticator before signing in', async () => {
    authApi.login.mockResolvedValue({ success: true, data: { nextStep: 'verify', ticket: 'restricted-ticket' } });
    authApi.mfaVerify.mockResolvedValue({ success: true, data: { user: { role: 'PATIENT' } } });
    const { user, login } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@example.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'fixture-password');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await user.type(await screen.findByLabelText('Authenticator code'), '123456');
    expect(login).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(authApi.mfaVerify).toHaveBeenCalledWith('restricted-ticket', '123456');
    expect(login).toHaveBeenCalledWith({ role: 'PATIENT' });
});

test('enrollment shows a local setup key and recovery codes before acknowledging sign-in', async () => {
    authApi.login.mockResolvedValue({ success: true, data: { nextStep: 'enroll', ticket: 'setup-ticket' } });
    authApi.mfaStartSetup.mockResolvedValue({ success: true, data: { secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', provisioningUri: 'otpauth://totp/Medicare:fixture?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' } });
    authApi.mfaConfirmSetup.mockResolvedValue({ success: true, data: { recoveryCodes: ['fixture-recovery-one', 'fixture-recovery-two'] } });
    authApi.mfaAcknowledgeSetup.mockResolvedValue({ success: true, data: { user: { role: 'PATIENT' } } });
    const { user, login } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@example.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'fixture-password');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Start authenticator setup' }));
    expect(await screen.findByLabelText('Manual setup key')).toHaveTextContent('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    await user.type(screen.getByLabelText('Authenticator code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm authenticator' }));
    expect(await screen.findByText('fixture-recovery-one')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Finish secure sign-in' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I saved my recovery codes in a safe place' }));
    await user.click(screen.getByRole('button', { name: 'Finish secure sign-in' }));
    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(localStorage.getItem('healthcare_token')).toBeNull();
});

test('a recovery code starts authenticator replacement without signing in', async () => {
    authApi.login.mockResolvedValue({ data: { nextStep: 'verify', ticket: 'recovery-ticket' } });
    authApi.mfaRecover.mockResolvedValue({ data: { nextStep: 'enroll' } });
    const { user, login } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@example.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'fixture-password');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Use a recovery code' }));
    const recovery = '12345678-12345678-12345678-12345678';
    await user.type(screen.getByLabelText('Recovery code'), recovery);
    await user.click(screen.getByRole('button', { name: 'Verify recovery code' }));
    expect(await screen.findByRole('button', { name: 'Start authenticator setup' })).toBeInTheDocument();
    expect(authApi.mfaRecover).toHaveBeenCalledWith('recovery-ticket', recovery);
    expect(login).not.toHaveBeenCalled();
});

test('only exposes the active form and preserves passkey sign in', async () => {
    authApi.passkeyLoginOptions.mockResolvedValue({ success: true, data: { challenge: 'test' } });
    startAuthentication.mockResolvedValue({ id: 'credential' });
    authApi.passkeyLoginVerify.mockResolvedValue({ data: { user: { role: 'PATIENT' } } });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Passkey', exact: true }));
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    await user.type(screen.getByLabelText('Email or phone'), 'patient@demo.invalid');
    await user.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: 'test' } });
});

test('offers account creation and explains role-based access', () => {
    setup();
    expect(screen.queryByRole('region', { name: 'Security check' })).not.toBeInTheDocument();
    expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
    expect(screen.getByText('Your records are available according to your role and sharing permissions.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a patient account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Read privacy notice' })).toHaveAttribute('href', '/privacy-notice');
});

test.each([428, 400, 503])('reveals a security check for status %s and consumes each token before another attempt', async (status) => {
    let options;
    window.turnstile = { render: vi.fn((element, config) => { options = config; return 'login-widget'; }), reset: vi.fn(), remove: vi.fn() };
    authApi.login.mockRejectedValueOnce({ response: { status, data: { message: 'Complete the security check and try again.', code: 'BOT_CHALLENGE_REQUIRED', challenge: { siteKey: 'public-site-key', action: 'public_auth' } } } })
        .mockRejectedValue({ response: { status: 401, data: { message: 'Invalid credentials' } } });
    const { user } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@demo.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    act(() => options.callback('first-token'));
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(authApi.login).toHaveBeenLastCalledWith('patient@demo.invalid', 'password', 'first-token');
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    expect(window.turnstile.reset).toHaveBeenCalledWith('login-widget');
    act(() => options.callback('fresh-token'));
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    act(() => options['expired-callback']());
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Passkey', exact: true }));
    expect(window.turnstile.remove).toHaveBeenCalledWith('login-widget');
    expect(screen.getByRole('button', { name: 'Sign in with passkey' })).toBeEnabled();
});
