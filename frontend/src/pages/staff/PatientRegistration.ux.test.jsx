import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import PatientRegistration from './PatientRegistration';

vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../api/authApi', () => ({ authApi: { registerPatient: vi.fn() } }));

test('optional registration details stay editable and submit after their sections are collapsed', async () => {
    authApi.registerPatient.mockResolvedValue({});
    const { container } = render(
        <MemoryRouter>
            <AuthContext.Provider value={{ user: { role: 'receptionist' } }}>
                <PatientRegistration />
            </AuthContext.Provider>
        </MemoryRouter>
    );
    const demographics = screen.getByText('Demographics & address').closest('details');
    const contacts = screen.getByText('Contacts & insurance').closest('details');
    expect(demographics).not.toHaveAttribute('open');
    expect(contacts).not.toHaveAttribute('open');
    expect(container.querySelectorAll('input[required]')).toHaveLength(6);
    expect(demographics.querySelector('[required]')).toBeNull();
    expect(contacts.querySelector('[required]')).toBeNull();

    fireEvent.click(demographics.querySelector('summary'));
    fireEvent.click(contacts.querySelector('summary'));
    expect(demographics).toHaveAttribute('open');
    expect(contacts).toHaveAttribute('open');
    const payload = {
        firstName: 'Patient', lastName: 'Fixture', email: 'patient@example.invalid', phone: '+15555550123',
        dateOfBirth: '2000-01-01', password: 'SecurePassword123!', gender: 'Female', bloodGroup: 'O+',
        govtId: 'TEST-ID', address: '10 Example Lane', city: 'Example City', state: 'Example Region',
        country: 'Example Country', postalCode: '12345', emergencyContactName: 'Contact Fixture',
        emergencyContactPhone: '+15555550124', emergencyContactRelation: 'Sibling',
        insuranceProvider: 'Fixture Insurance', insurancePolicyNumber: 'POL-123',
    };
    for (const [name, value] of Object.entries(payload)) {
        fireEvent.change(container.querySelector(`[name="${name}"]`), { target: { value } });
    }
    fireEvent.click(demographics.querySelector('summary'));
    fireEvent.click(contacts.querySelector('summary'));
    expect(demographics).not.toHaveAttribute('open');
    expect(contacts).not.toHaveAttribute('open');

    fireEvent.click(demographics.querySelector('summary'));
    expect(screen.getByLabelText('Address')).toHaveValue(payload.address);
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '12 Updated Lane' } });
    fireEvent.click(demographics.querySelector('summary'));
    fireEvent.click(screen.getByRole('button', { name: 'Register Patient' }));

    await waitFor(() => expect(authApi.registerPatient).toHaveBeenLastCalledWith({ ...payload, address: '12 Updated Lane' }));
});
