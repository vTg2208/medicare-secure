import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Register from './Register';
import { authApi } from '../../api/authApi';

vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../api/authApi', () => ({ authApi: { registerPatient: vi.fn(), verifyOTP: vi.fn(), login: vi.fn() } }));

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
