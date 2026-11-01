import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrescriptionForm from './PrescriptionForm';
import DiagnosisSelector from './DiagnosisSelector';

test.each([
    ['Once daily', 'oral'], ['Three times daily', 'intravenous'],
    ['Four times daily', 'intramuscular'], ['Before meals', 'subcutaneous'],
    ['After meals', 'topical'], ['At bedtime', 'inhalation'],
])('submits a supported prescription frequency %s and route %s', async (frequency, route) => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PrescriptionForm onAdd={onAdd} />);
    await user.type(screen.getByPlaceholderText('e.g., Amoxicillin'), 'Amoxicillin');
    await user.type(screen.getByPlaceholderText('e.g., 500mg'), '500mg');
    const [frequencySelect, routeSelect] = screen.getAllByRole('combobox');
    await user.selectOptions(frequencySelect, frequency);
    await user.selectOptions(routeSelect, route);
    await user.click(screen.getByRole('button', { name: 'Add Prescription' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ medication: 'Amoxicillin', frequency, route }));
});

test('submits an ICD diagnosis using the EMR contract', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<DiagnosisSelector onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: /J06.9.*Upper Respiratory Infection/ }));
    await user.click(screen.getByRole('button', { name: 'Add Diagnosis' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ icdCode: 'J06.9', description: 'Upper Respiratory Infection', isPrimary: true, status: 'active' }));
});
