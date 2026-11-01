import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { pharmacistApi } from '../../api/pharmacistApi';
import PrescriptionQueue from './PrescriptionQueue';

test('lets pharmacy dispense an active prescription and shows a server conflict', async () => {
    const user = userEvent.setup();
    vi.spyOn(pharmacistApi, 'getPrescriptions').mockResolvedValue({ success: true, data: [{ id: 'rx', status: 'active', medication: 'Medication A', patientName: 'Patient One' }] });
    vi.spyOn(pharmacistApi, 'dispensePrescription').mockRejectedValue({ response: { data: { message: 'Cannot transition from cancelled to completed' } } });
    render(<MemoryRouter><AuthContext.Provider value={{ logout: vi.fn() }}><ThemeProvider><PrescriptionQueue /></ThemeProvider></AuthContext.Provider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Dispense' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot transition from cancelled to completed');
    expect(screen.getByText('Medication A')).toBeInTheDocument();
});
