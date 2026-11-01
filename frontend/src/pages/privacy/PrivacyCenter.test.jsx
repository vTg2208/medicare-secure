import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import PrivacyCenter from './PrivacyCenter';
import { privacyApi } from '../../api/privacyApi';
vi.mock('../../api/privacyApi', () => ({ privacyApi: { requests: vi.fn(), review: vi.fn(), submit: vi.fn(), update: vi.fn(), exportData: vi.fn() } }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
const renderAs = role => render(<MemoryRouter><AuthContext.Provider value={{ user: { role }, logout: vi.fn() }}><PrivacyCenter /></AuthContext.Provider></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); privacyApi.requests.mockResolvedValue([]); privacyApi.review.mockResolvedValue([]); });
test('patients can submit a privacy request with their chosen type and details', async () => {
    const user = userEvent.setup(); privacyApi.submit.mockResolvedValue({ id: 'created' });
    renderAs('patient');
    await user.selectOptions(screen.getByLabelText('Request type'), 'rectification');
    await user.type(screen.getByLabelText('What would you like us to review?'), 'Please correct my date of birth.');
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    await waitFor(() => expect(privacyApi.submit).toHaveBeenCalledWith({ type: 'rectification', details: 'Please correct my date of birth.' }));
    expect(await screen.findByText('Request submitted. Its review date and decision history appear below.')).toHaveAttribute('role', 'status');
});
test('export errors are accessible and the confirmation password is cleared', async () => {
    const user = userEvent.setup(); privacyApi.exportData.mockRejectedValue({ response: { data: { message: 'Current password could not be confirmed' } } });
    renderAs('patient');
    const password = screen.getByLabelText('Current password');
    await user.type(password, 'entered-password');
    await user.click(screen.getByRole('button', { name: 'Download my information' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password could not be confirmed');
    expect(password).toHaveValue('');
    expect(privacyApi.exportData).toHaveBeenCalledWith('entered-password');
});
test('a reviewer sees the review queue and cannot export a patient account', async () => {
    renderAs('compliance_officer');
    expect(await screen.findByRole('heading', { name: 'Privacy requests' })).toBeInTheDocument();
    await waitFor(() => expect(privacyApi.review).toHaveBeenCalled());
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit request' })).not.toBeInTheDocument();
});
test('a failed queue load is visible and does not claim an empty queue', async () => {
    privacyApi.requests.mockRejectedValue(new Error('offline'));
    renderAs('patient');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load privacy requests');
    expect(screen.queryByText('No privacy requests yet.')).not.toBeInTheDocument();
});
