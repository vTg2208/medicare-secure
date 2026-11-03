import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserManagement from './UserManagement';
import { userApi } from '../../api/userApi';
vi.mock('../../api/userApi', () => ({ userApi: { getAllUsers: vi.fn(), deactivateStaff: vi.fn() } }));
vi.mock('./HospitalAdminDashboard', () => ({ AdminSidebar: () => null }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
const row = (id, name) => ({ id, first_name: name, last_name: 'Example', email: `${id}@example.test`, role: 'patient', is_active: true, created_at: '2026-01-01' });
afterEach(() => vi.useRealTimers());
beforeEach(() => userApi.getAllUsers.mockReset().mockImplementation(async (_role, params = {}) => ({ success: true,
    data: [row(params.search ? 'matched' : String(params.offset || 0), params.search ? 'Beyond first page' : 'Current page')],
    pagination: { total: params.search ? 1 : 45, limit: 20, offset: params.offset || 0 } })));

test('pages through server results and debounces a search across all users', async () => {
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
    await screen.findByText('Current page Example');
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    await waitFor(() => expect(userApi.getAllUsers).toHaveBeenLastCalledWith(null, expect.objectContaining({ offset: 20, limit: 20 })));
    const initialCalls = userApi.getAllUsers.mock.calls.length;
    const input = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.change(input, { target: { value: 'Be' } });
    fireEvent.change(input, { target: { value: 'Beyond' } });
    expect(userApi.getAllUsers).toHaveBeenCalledTimes(initialCalls);
    await screen.findByText('Beyond first page Example');
    expect(userApi.getAllUsers).toHaveBeenLastCalledWith(null, expect.objectContaining({ search: 'Beyond', offset: 0 }));
    expect(userApi.getAllUsers).toHaveBeenCalledTimes(initialCalls + 1);
});
test('does not replace a newer search with a late previous response', async () => {
    let resolveOld;
    userApi.getAllUsers.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
    await waitFor(() => expect(resolveOld).toBeTypeOf('function'));
    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), { target: { value: 'Beyond' } });
    await screen.findByText('Beyond first page Example');
    resolveOld({ success: true, data: [row('old', 'Outdated')], pagination: { total: 1, limit: 20, offset: 0 } });
    await waitFor(() => expect(screen.queryByText('Outdated Example')).not.toBeInTheDocument());
    expect(screen.getByText('Beyond first page Example')).toBeInTheDocument();
});
test('a pending deactivation refreshes the current search instead of its original page', async () => {
    let finish;
    userApi.deactivateStaff.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
    await screen.findByText('Current page Example');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), { target: { value: 'Beyond' } });
    await screen.findByText('Beyond first page Example');
    finish({ success: true });
    await waitFor(() => expect(userApi.getAllUsers).toHaveBeenCalledTimes(3));
    expect(userApi.getAllUsers).toHaveBeenLastCalledWith(null, expect.objectContaining({ search: 'Beyond', offset: 0 }));
    expect(screen.getByText('Beyond first page Example')).toBeInTheDocument();
});
