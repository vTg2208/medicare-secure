import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { authApi } from '../../api/authApi';
import { startAuthentication } from '@simplewebauthn/browser';
import Login from './Login';

vi.mock('../../api/authApi', () => ({ authApi: { login: vi.fn(), passkeyLoginOptions: vi.fn(), passkeyLoginVerify: vi.fn() } }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));
const demo = vi.hoisted(() => ({ isDemoMode: false }));
vi.mock('../../config/demoMode', () => demo);

function setup() {
    const login = vi.fn();
    render(<MemoryRouter initialEntries={['/login']}><ThemeProvider><AuthContext.Provider value={{ login }}><Routes><Route path="/login" element={<Login />} /><Route path="/patient/dashboard" element={<h1>Patient dashboard</h1>} /></Routes></AuthContext.Provider></ThemeProvider></MemoryRouter>);
    return { user: userEvent.setup(), login };
}
beforeEach(() => { vi.clearAllMocks(); demo.isDemoMode = false; });

test('signs in through labelled fields and routes to the patient dashboard', async () => {
    authApi.login.mockResolvedValue({ data: { user: { role: 'PATIENT' }, accessToken: 'test-token' } });
    const { user, login } = setup();
    await user.type(screen.getByLabelText('Email or phone'), 'patient@demo.invalid');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'test-password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith({ role: 'PATIENT' }, 'test-token');
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

test('only exposes the active form and preserves passkey sign in', async () => {
    authApi.passkeyLoginOptions.mockResolvedValue({ success: true, data: { challenge: 'test' } });
    startAuthentication.mockResolvedValue({ id: 'credential' });
    authApi.passkeyLoginVerify.mockResolvedValue({ data: { user: { role: 'PATIENT' }, accessToken: 'test-token' } });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Passkey', exact: true }));
    expect(screen.queryByLabelText('Password', { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    await user.type(screen.getByLabelText('Email or phone'), 'patient@demo.invalid');
    await user.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: { challenge: 'test' } });
});

test('demo login directs visitors to assigned accounts without offering registration', () => {
    demo.isDemoMode = true;
    setup();
    expect(screen.getByText(/Use an assigned demo account/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create a patient account' })).not.toBeInTheDocument();
});
