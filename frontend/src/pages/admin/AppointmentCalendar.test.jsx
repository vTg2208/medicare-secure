import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import apiClient from '../../api/client';
import AppointmentCalendar from './AppointmentCalendar';

test('unpublished hours are explicit and the administrator can publish a real calendar', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient,'get').mockImplementation(async path => ({data:{data:path==='/users/doctors' ? [{id:'doctor',organization_id:'hospital',firstName:'Current',lastName:'Clinician',organization_name:'Current clinic'}] : null}}));
    const put = vi.spyOn(apiClient,'put').mockResolvedValue({data:{success:true}});
    render(<MemoryRouter><ThemeProvider><AppointmentCalendar /></ThemeProvider></MemoryRouter>);
    await screen.findByRole('option',{name:/Current Clinician/});
    await user.selectOptions(screen.getByLabelText('Doctor and clinic'),'doctor:hospital');
    expect(await screen.findByRole('status')).toHaveTextContent('unsaved defaults');
    await user.clear(screen.getByLabelText('Clinic time zone'));
    await user.type(screen.getByLabelText('Clinic time zone'),'Asia/Kolkata');
    await user.click(screen.getByRole('button',{name:'Save clinic hours'}));
    expect(await screen.findByRole('status')).toHaveTextContent('Clinic hours saved');
    expect(put).toHaveBeenCalledWith('/appointments/calendar',expect.objectContaining({doctorId:'doctor',organizationId:'hospital',timeZone:'Asia/Kolkata',weekdays:[1,2,3,4,5]}));
});
test('a save conflict leaves the calendar editable for retry', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient,'get').mockImplementation(async path => ({data:{data:path==='/users/doctors' ? [{id:'doctor',organization_id:'hospital',firstName:'Current'}] : null}}));
    vi.spyOn(apiClient,'put').mockRejectedValue({response:{data:{message:'Temporary outage'}}});
    render(<MemoryRouter><ThemeProvider><AppointmentCalendar /></ThemeProvider></MemoryRouter>);
    await screen.findByRole('option',{name:/Current/});
    await user.selectOptions(screen.getByLabelText('Doctor and clinic'),'doctor:hospital');
    await screen.findByRole('status');
    await user.click(screen.getByRole('button',{name:'Save clinic hours'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporary outage');
    expect(screen.getByRole('button',{name:'Save clinic hours'})).toBeEnabled();
    await waitFor(()=>expect(screen.getByLabelText('Clinic time zone')).toBeEnabled());
});
