import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { emrApi } from '../../api/emrApi';
import MedicalRecords from './MedicalRecords';
vi.mock('../../api/emrApi', () => ({ emrApi: { getPatientMedicalRecords: vi.fn() } }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../components/emr/RelatedRecordDetails', () => ({ default: () => null }));
const record = title => ({ id: title, title, type: 'consultation', description: 'Visit summary', created_at: '2026-01-01', created_by_name: 'Dr Example' });
const display = () => render(<MemoryRouter><AuthContext.Provider value={{ user: { id: 'patient', firstName: 'Pat' }, logout: vi.fn() }}><MedicalRecords /></AuthContext.Provider></MemoryRouter>);
beforeEach(() => emrApi.getPatientMedicalRecords.mockReset().mockImplementation(async (_id, params = {}) => ({ success: true,
    data: { records: [record(params.search ? 'Older matching visit' : 'Routine visit')], pagination: { total: params.search ? 1 : 65, limit: 20, offset: params.offset || 0 } } })));

test('paginates records and searches the full patient history after typing settles', async () => {
    display();
    await screen.findAllByText('Routine visit');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(emrApi.getPatientMedicalRecords).toHaveBeenLastCalledWith('patient', expect.objectContaining({ offset: 20, summary: true })));
    const calls = emrApi.getPatientMedicalRecords.mock.calls.length;
    const input = screen.getByPlaceholderText('Search in records (titles, summaries, doctors)...');
    fireEvent.change(input, { target: { value: 'Old' } });
    fireEvent.change(input, { target: { value: 'Older' } });
    expect(emrApi.getPatientMedicalRecords).toHaveBeenCalledTimes(calls);
    await screen.findAllByText('Older matching visit');
    expect(emrApi.getPatientMedicalRecords).toHaveBeenLastCalledWith('patient', expect.objectContaining({ search: 'Older', offset: 0 }));
    expect(emrApi.getPatientMedicalRecords).toHaveBeenCalledTimes(calls + 1);
});
test('keeps failures visible and allows retry', async () => {
    emrApi.getPatientMedicalRecords.mockRejectedValueOnce(Error('offline'));
    display();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findAllByText('Routine visit');
});
