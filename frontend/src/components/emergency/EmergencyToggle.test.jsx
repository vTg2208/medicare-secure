import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmergencyToggle from './EmergencyToggle';
import apiClient from '../../api/client';

const grant = { id: 'grant-1', patient_id: 'patient-1', expires_at: new Date(Date.now() + 3600000).toISOString() };
const justification = 'Emergency care requires immediate review of patient records.';

test('activates audited access with patient and justification, then revokes it', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } });
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: { data: grant } }).mockResolvedValueOnce({ data: { success: true } });
    const onToggle = vi.fn();
    render(<EmergencyToggle onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: 'Request emergency record access' }));
    await user.type(screen.getByLabelText('Patient ID'), 'patient-1');
    await user.type(screen.getByLabelText('Emergency justification'), justification);
    await user.click(screen.getByRole('button', { name: 'Activate audited read access' }));
    expect(await screen.findByText('Patient patient-1')).toBeInTheDocument();
    expect(post).toHaveBeenNthCalledWith(1, '/emergency/activate', { patientId: 'patient-1', justification });
    expect(onToggle).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Revoke access' }));
    await waitFor(() => expect(screen.queryByText('Patient patient-1')).not.toBeInTheDocument());
    expect(post).toHaveBeenNthCalledWith(2, '/emergency/grant-1/revoke');
    expect(onToggle).toHaveBeenLastCalledWith(false);
});

test('retains the form and server error when activation fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [] } });
    vi.spyOn(apiClient, 'post').mockRejectedValue({ response: { data: { message: 'An active visit is required' } } });
    const onToggle = vi.fn();
    render(<EmergencyToggle onToggle={onToggle} />);
    await user.click(screen.getByRole('button', { name: 'Request emergency record access' }));
    await user.type(screen.getByLabelText('Patient ID'), 'patient-1');
    await user.type(screen.getByLabelText('Emergency justification'), justification);
    await user.click(screen.getByRole('button', { name: 'Activate audited read access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An active visit is required');
    expect(screen.getByLabelText('Emergency justification')).toHaveValue(justification);
    expect(onToggle).not.toHaveBeenCalled();
});

test('keeps active access visible when revocation fails and hides expired grants', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: [grant, { ...grant, id: 'expired', patient_id: 'old-patient', expires_at: '2000-01-01' }] } });
    vi.spyOn(apiClient, 'post').mockRejectedValue({ response: { data: { message: 'Please retry revocation' } } });
    render(<EmergencyToggle />);
    await screen.findByText('Patient patient-1');
    expect(screen.queryByText('Patient old-patient')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revoke access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please retry revocation');
    expect(screen.getByText('Patient patient-1')).toBeInTheDocument();
});
