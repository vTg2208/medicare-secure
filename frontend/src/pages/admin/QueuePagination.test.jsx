import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';
import VisitManagement from './VisitManagement';
import AuditLogs from './AuditLogs';
import ActiveVisits from '../doctor/ActiveVisits';
import ReceptionistVisitManagement from '../receptionist/ReceptionistVisitManagement';

vi.mock('./HospitalAdminDashboard', () => ({ AdminSidebar: () => null }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));

function renderScreen(Screen) {
    render(<MemoryRouter><AuthContext.Provider value={{ logout: vi.fn() }}><Screen /></AuthContext.Provider></MemoryRouter>);
}

test.each([
    ['admin', VisitManagement, '/visits/hospital', 'pending'],
    ['receptionist', ReceptionistVisitManagement, '/visits/hospital', 'pending'],
    ['doctor', ActiveVisits, '/visits/assigned', undefined]
])('%s queue searches across pages and resets to the first page', async (_role, Screen, path, status) => {
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (_url, { params }) => {
        const name = params.search || params.offset ? 'Older' : 'First';
        return { data: { success: true, data: [{
            id: name, patient_first_name: name, patient_last_name: 'Patient',
            status: status || 'checked_in', created_at: '2026-01-01T10:00:00Z'
        }], pagination: { total: params.search ? 1 : 21 } } };
    });
    renderScreen(Screen);
    await screen.findByText('First Patient');
    expect(screen.queryByText('Older Patient')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Older Patient');
    expect(get).toHaveBeenLastCalledWith(path, { params: expect.objectContaining({ offset: 20, status }) });

    const search = screen.getByRole('searchbox', { name: 'Search visits' });
    fireEvent.change(search, { target: { value: 'Old' } });
    fireEvent.change(search, { target: { value: 'Older' } });
    expect(get).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(path, {
        params: expect.objectContaining({ search: 'Older', offset: 0, limit: 20, status })
    }));
    await screen.findByText('Page 1 of 1 · 1 results');
    expect(screen.getByText('Older Patient')).toBeInTheDocument();
});

test('admin audit search combines action and date filters with page-one results', async () => {
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (_url, { params }) => {
        const details = params.search || params.page === 2 ? 'Older audit event' : 'First audit event';
        return { data: { success: true, data: [{
            id: details, action: 'approve_visit', timestamp: '2026-01-01T10:00:00Z', details
        }], pagination: { total: params.search ? 1 : 21 } } };
    });
    renderScreen(AuditLogs);
    await screen.findByText('First audit event');
    expect(screen.queryByText('Older audit event')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Older audit event');
    expect(get).toHaveBeenLastCalledWith('/audit/logs', { params: expect.objectContaining({ page: 2 }) });

    fireEvent.change(screen.getByLabelText('Audit action'), { target: { value: 'approve_visit' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-02' } });
    fireEvent.change(screen.getByLabelText('Search audit logs'), { target: { value: 'Older' } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/audit/logs', {
        params: {
            page: 1, limit: 20, action: 'approve_visit', search: 'Older',
            startDate: new Date('2026-01-01T00:00:00').toISOString(),
            endBefore: new Date('2026-01-03T00:00:00').toISOString()
        }
    }));
    expect(await screen.findByText('Older audit event')).toBeInTheDocument();
});
