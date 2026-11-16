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
    expect(screen.getByText(/Times shown in Asia\/Kolkata/)).toBeInTheDocument();
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

test('expanded server slots retain the chosen appointment after collapse and Escape returns its draft', async () => {
    const user = userEvent.setup();
    const slots = Array.from({ length: 9 }, (_, index) => ({ startsAt: `2030-01-07T${String(index + 3).padStart(2, '0')}:30:00.000Z`, endsAt: `2030-01-07T${String(index + 4).padStart(2, '0')}:00:00.000Z` }));
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { timeZone: 'Asia/Kolkata', slots } } });
    const back = vi.fn();
    const book = vi.fn();
    render(<DoctorProfilePopup doctor={doctor} onBack={back} onBook={book} />);
    await screen.findByRole('button', { name: '9:00 AM' });
    expect(screen.queryByRole('button', { name: '5:00 PM' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all 9 appointments' }));
    await user.click(screen.getByRole('button', { name: '5:00 PM' }));
    await user.click(screen.getByRole('button', { name: 'Show fewer appointments' }));
    expect(screen.getByRole('button', { name: '5:00 PM' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Use selected appointment' }));
    expect(book).toHaveBeenCalledWith(expect.objectContaining({ scheduledTime: '2030-01-07T11:30:00.000Z', timeZone: 'Asia/Kolkata' }));
    await user.keyboard('{Escape}');
    expect(back).toHaveBeenCalledWith(expect.objectContaining({ doctorId: 'doctor', scheduledTime: '2030-01-07T11:30:00.000Z' }));
});

test('a restored appointment is rechecked against current server availability before booking', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { timeZone: 'Asia/Kolkata', slots: [] } } });
    render(<DoctorProfilePopup doctor={doctor} initialAppointment={{ doctorId: 'doctor', date: '2030-01-07', scheduledTime: '2030-01-07T03:30:00.000Z' }} onBack={vi.fn()} onBook={vi.fn()} />);
    expect(await screen.findByText('No available appointments on this date.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use selected appointment' })).toBeDisabled();
    expect(screen.queryByText(/Selected appointment:/)).not.toBeInTheDocument();
});
