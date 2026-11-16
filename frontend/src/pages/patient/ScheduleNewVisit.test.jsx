import React from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import ScheduleNewVisit from './ScheduleNewVisit';
import apiClient from '../../api/client';
import { userApi } from '../../api/userApi';
import { visitApi } from '../../api/visitApi';

const doctor = { id: 'doctor', organization_id: 'hospital', firstName: 'Current', lastName: 'Clinician', specialization: 'General practice' };
const setup = () => render(<MemoryRouter><ThemeProvider><ScheduleNewVisit /></ThemeProvider></MemoryRouter>);
beforeEach(() => {
    vi.spyOn(userApi, 'getDoctors').mockResolvedValue({ data: [doctor] });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { timeZone: 'Asia/Kolkata', slots: [{ startsAt: '2030-01-07T03:30:00.000Z', endsAt: '2030-01-07T04:00:00.000Z' }] } } });
    vi.spyOn(visitApi, 'createVisit').mockRejectedValue(new Error('offline'));
});

test('optional provider flow preserves a chosen server appointment through Back and submits its exact instant', async () => {
    const user = userEvent.setup();
    setup();
    const picker = await screen.findByRole('button', { name: /Any Available Doctor/ });
    await user.click(picker);
    await user.click(screen.getByRole('button', { name: /Dr. Current Clinician/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(within(screen.getByRole('navigation', { name: 'Booking progress' })).getByText('Appointment').closest('li')).toHaveAttribute('aria-current', 'step');
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /Dr. Current Clinician/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: '9:00 AM' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Use selected appointment' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(picker).toHaveFocus();
    expect(screen.getByText(/Selected appointment:/)).toHaveTextContent('9:00 AM');
    expect(within(screen.getByRole('navigation', { name: 'Booking progress' })).getByText('Request').closest('li')).toHaveAttribute('aria-current', 'step');
    await user.type(screen.getByRole('textbox', { name: 'Hospital Code' }), '100001');
    await user.type(screen.getByRole('textbox', { name: 'Reason for Visit' }), 'Checkup');
    await user.click(screen.getByRole('button', { name: /Submit Request/ }));
    await waitFor(() => expect(visitApi.createVisit).toHaveBeenCalledWith({ hospitalCode: '100001', reason: 'Checkup', symptoms: '', doctorId: 'doctor', scheduledTime: '2030-01-07T03:30:00.000Z' }));
});

test('a visit can still be requested with any available doctor and no chosen appointment', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('button', { name: /Any Available Doctor/ });
    await user.type(screen.getByRole('textbox', { name: 'Hospital Code' }), '100001');
    await user.type(screen.getByRole('textbox', { name: 'Reason for Visit' }), 'Checkup');
    await user.click(screen.getByRole('button', { name: /Submit Request/ }));
    await waitFor(() => expect(visitApi.createVisit).toHaveBeenCalledWith({ hospitalCode: '100001', reason: 'Checkup', symptoms: '', doctorId: '', scheduledTime: undefined }));
});
