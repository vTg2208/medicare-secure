import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DoctorProfilePopup from './DoctorProfilePopup';
import apiClient from '../../api/client';

const doctor = { id: 'doctor', organization_id: 'hospital', firstName: 'Current', lastName: 'Clinician', specialization: 'General practice' };
test('only server availability can be selected and the exact appointment instant reaches the request form', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { timeZone: 'Asia/Kolkata', slots: [{ startsAt: '2030-01-07T03:30:00.000Z', endsAt: '2030-01-07T04:00:00.000Z' }] } } });
    const book = vi.fn();
    render(<DoctorProfilePopup doctor={doctor} onBack={vi.fn()} onBook={book} />);
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }));
    await user.click(screen.getByRole('button', { name: 'Use selected appointment' }));
    expect(book).toHaveBeenCalledWith(expect.objectContaining({ doctorId: 'doctor', organizationId: 'hospital', scheduledTime: '2030-01-07T03:30:00.000Z' }));
    expect(screen.getByText(/Asia\/Kolkata/)).toBeInTheDocument();
});
test('availability failure has a retry and an unconfigured calendar invents no slots', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));
    render(<DoctorProfilePopup doctor={doctor} onBack={vi.fn()} onBook={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load availability');
    get.mockResolvedValue({ data: { data: { timeZone: null, slots: [] } } });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No available appointments on this date.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use selected appointment' })).toBeDisabled();
});
