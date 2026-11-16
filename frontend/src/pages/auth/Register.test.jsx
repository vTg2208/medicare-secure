import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Register from './Register';
import { authApi } from '../../api/authApi';

vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../api/authApi', () => ({ authApi: { registerPatient: vi.fn(), registerDoctor: vi.fn(), verifyOTP: vi.fn(), login: vi.fn(), resendOTP: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => { delete window.turnstile; });

test('keeps patient progress accurate through verification and optional passkey setup', async () => {
    authApi.registerPatient.mockResolvedValue({ message: 'Check your email' });
    authApi.verifyOTP.mockResolvedValue({});
    authApi.login.mockResolvedValue({ accessToken: 'fixture' });
    const { container } = render(<MemoryRouter><Routes><Route path="/" element={<Register />} /><Route path="/login" element={<h1>Sign in</h1>} /></Routes></MemoryRouter>);
    const progress = screen.getByRole('navigation', { name: 'Registration progress' });
    expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent('Account');
    expect(within(progress).getByText('Optional')).toBeVisible();
    for (const [name, value] of Object.entries({ name: 'Patient Example', aadhaarId: '123456789012', email: 'patient@example.test', phone: '9876543210', password: 'Example123!', confirmPassword: 'Example123!' })) {
        fireEvent.change(container.querySelector(`input[name="${name}"]`), { target: { value } });
    }
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Verify OTP' });
    expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent('Verify email');
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Account Verified!' });
    expect(progress.querySelector('[aria-current="step"]')).toHaveTextContent('Passkey');
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('shows the credential review flow for doctors without patient verification steps', () => {
    render(<MemoryRouter><Register /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Doctor/ }));
    const progress = screen.getByRole('navigation', { name: 'Registration progress' });
    expect(within(progress).getByText('Review')).toBeVisible();
    expect(within(progress).queryByText('Verify email')).not.toBeInTheDocument();
    expect(within(progress).queryByText('Passkey')).not.toBeInTheDocument();
});

test('requires a fresh challenge after registration and resend before signing in after OTP verification', async () => {
    let options;
    window.turnstile = { render: vi.fn((element, config) => { options = config; return 'register-widget'; }), reset: vi.fn(), remove: vi.fn() };
    const required = { response: { status: 428, data: { message: 'Complete the security check and try again.', code: 'BOT_CHALLENGE_REQUIRED', challenge: { siteKey: 'public-site-key', action: 'public_auth' } } } };
    authApi.registerPatient.mockRejectedValueOnce(required).mockResolvedValue({ message: 'Check your email' });
    authApi.resendOTP.mockResolvedValue({ message: 'Code resent' });
    authApi.verifyOTP.mockResolvedValue({});
    authApi.login.mockResolvedValue({ accessToken: 'fixture' });
    const { container } = render(<MemoryRouter><Register /></MemoryRouter>);
    for (const [name, value] of Object.entries({ name: 'Patient Example', aadhaarId: '123456789012', email: 'patient@example.test', phone: '9876543210', password: 'Example123!', confirmPassword: 'Example123!' })) {
        fireEvent.change(container.querySelector(`input[name="${name}"]`), { target: { value } });
    }
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Register as Patient' })).toBeDisabled();
    act(() => options.callback('registration-token'));
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Verify OTP' });
    expect(authApi.registerPatient.mock.lastCall[1]).toEqual({ challengeToken: 'registration-token' });
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();
        await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(2));
    act(() => options.callback('resend-token'));
    fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
    await screen.findByText('Code resent');
    expect(authApi.resendOTP).toHaveBeenCalledWith('patient@example.test', 'resend-token');
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();
    act(() => options.callback('login-token'));
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Account Verified!' });
    expect(authApi.verifyOTP).toHaveBeenCalledWith('patient@example.test', '123456');
    expect(authApi.login).toHaveBeenCalledWith('patient@example.test', 'Example123!', 'login-token');
    expect(window.turnstile.remove).toHaveBeenCalled();
});

test('keeps a verified OTP valid while a newly required auto-login challenge is completed', async () => {
    let options;
    window.turnstile = { render: vi.fn((element, config) => { options = config; return 'widget'; }), reset: vi.fn(), remove: vi.fn() };
    authApi.registerPatient.mockResolvedValue({ message: 'Check your email' });
    authApi.verifyOTP.mockResolvedValue({});
    authApi.login.mockRejectedValueOnce({ response: { status: 428, data: { message: 'Complete the security check and try again.', challenge: { siteKey: 'public-site-key', action: 'public_auth' } } } }).mockResolvedValue({ accessToken: 'fixture' });
    const { container } = render(<MemoryRouter><Register /></MemoryRouter>);
    for (const [name, value] of Object.entries({ name: 'Patient Example', aadhaarId: '123456789012', email: 'patient@example.test', phone: '9876543210', password: 'Example123!', confirmPassword: 'Example123!' })) {
        fireEvent.change(container.querySelector(`input[name="${name}"]`), { target: { value } });
    }
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Verify OTP' });
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    act(() => options.callback('fresh-login-token'));
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Account Verified!' });
    expect(authApi.verifyOTP).toHaveBeenCalledTimes(1);
    expect(authApi.login).toHaveBeenLastCalledWith('patient@example.test', 'Example123!', 'fresh-login-token');
});

test('email-only OTP verification stays available after a resend requires a challenge', async () => {
    window.turnstile = { render: vi.fn(() => 'widget'), reset: vi.fn(), remove: vi.fn() };
    authApi.resendOTP.mockRejectedValue({ response: { status: 428, data: { message: 'Complete the security check and try again.', challenge: { siteKey: 'public-site-key', action: 'public_auth' } } } });
    authApi.verifyOTP.mockResolvedValue({});
    render(<MemoryRouter initialEntries={['/register?verify=1']}><Routes><Route path="/register" element={<Register />} /><Route path="/login" element={<h1>Sign in</h1>} /></Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'patient@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' }));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Resend OTP' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(authApi.login).not.toHaveBeenCalled();
});

test('starting another registration clears the previous OTP verification before auto-login', async () => {
    let options;
    window.turnstile = { render: vi.fn((element, config) => { options = config; return 'widget'; }), reset: vi.fn(), remove: vi.fn() };
    authApi.registerPatient.mockResolvedValue({ message: 'Check your email' });
    authApi.verifyOTP.mockResolvedValue({});
    authApi.login.mockRejectedValueOnce({ response: { status: 428, data: { message: 'Complete the security check and try again.', challenge: { siteKey: 'public-site-key', action: 'public_auth' } } } }).mockResolvedValue({ accessToken: 'fixture' });
    const { container } = render(<MemoryRouter><Register /></MemoryRouter>);
    for (const [name, value] of Object.entries({ name: 'Patient Example', aadhaarId: '123456789012', email: 'first@example.test', phone: '9876543210', password: 'Example123!', confirmPassword: 'Example123!' })) {
        fireEvent.change(container.querySelector(`input[name="${name}"]`), { target: { value } });
    }
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Verify OTP' });
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Registration' }));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(2));
    fireEvent.change(container.querySelector('input[name="email"]'), { target: { value: 'second@example.test' } });
    act(() => options.callback('registration-token'));
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Verify OTP' });
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(3));
    act(() => options.callback('login-token'));
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '654321' } });
    fireEvent.submit(container.querySelector('form'));
    await screen.findByRole('heading', { name: 'Account Verified!' });
    expect(authApi.verifyOTP).toHaveBeenCalledTimes(2);
    expect(authApi.verifyOTP).toHaveBeenLastCalledWith('second@example.test', '654321');
});
