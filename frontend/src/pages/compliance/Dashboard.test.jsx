import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import { complianceApi } from '../../api/complianceApi';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { firstName: 'Test' }, logout: vi.fn() }) }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../api/complianceApi', () => ({ complianceApi: { getDashboardStats: vi.fn(), getIncidents: vi.fn() } }));
const data = { authAnomalies: 0, openIncidents: 2, activeOverrides: 0, pendingReviews: 1, investigatingIncidents: 1,
    criticalIncidents: 1, highIncidents: 0, securityStatus: 'critical', generatedAt: '2026-11-17T08:00:00Z',
    recentIncidents: [{ id: 'event', type: 'Suspicious Activity', severity: 'Critical', status: 'Open', reporter: 'System', date: '2026-11-17T07:59:00Z', description: 'Review this recorded event' }] };
const mount = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);
beforeEach(() => {
    complianceApi.getDashboardStats.mockResolvedValue({ success: true, data });
    complianceApi.getIncidents.mockResolvedValue({ success: true, data: [] });
});
afterEach(() => { vi.useRealTimers(); });

test('shows evidence-based status and recent active events instead of a secure assertion', async () => {
    mount();
    expect(await screen.findByText('Critical incidents open')).toBeInTheDocument();
    expect(screen.getByText('Review this recorded event')).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.queryByText('System Secure')).not.toBeInTheDocument();
    expect(complianceApi.getIncidents).not.toHaveBeenCalled();
});

test('initial failure shows unknown status and a retry, never an empty or secure result', async () => {
    complianceApi.getDashboardStats.mockRejectedValueOnce(new Error('offline'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to refresh');
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No active incidents reported.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    expect(await screen.findByText('Critical incidents open')).toBeInTheDocument();
});

test('retains a successful snapshot but labels it stale after a refresh fails', async () => {
    mount(); await screen.findByText('Critical incidents open');
    complianceApi.getDashboardStats.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('stale');
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('Review this recorded event')).toBeInTheDocument();
});

test('refreshes every 30 seconds, cancels requests on unmount and stops scheduling', async () => {
    vi.useFakeTimers();
    const view = mount();
    await act(async () => { await Promise.resolve(); });
    expect(complianceApi.getDashboardStats).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(complianceApi.getDashboardStats).toHaveBeenCalledTimes(2);
    const { signal } = complianceApi.getDashboardStats.mock.calls[1][0];
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(complianceApi.getDashboardStats).toHaveBeenCalledTimes(2);
});

test('manual refresh replaces old results and rejects unsuccessful API envelopes', async () => {
    mount(); await screen.findByText('Critical incidents open');
    complianceApi.getDashboardStats.mockResolvedValueOnce({ success: false });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await screen.findByRole('alert');
    complianceApi.getDashboardStats.mockResolvedValueOnce({ success: true, data: { ...data, securityStatus: 'clear', openIncidents: 0, pendingReviews: 0, criticalIncidents: 0, recentIncidents: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
    await waitFor(() => expect(screen.getByText('No open alerts')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('No active incidents reported.')).toBeInTheDocument();
});

test('a slow refresh cannot schedule overlapping requests or report empty data', async () => {
    vi.useFakeTimers();
    let resolve;
    complianceApi.getDashboardStats.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const view = mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(complianceApi.getDashboardStats).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Checking status…')).toBeInTheDocument();
    expect(screen.queryByText('No active incidents reported.')).not.toBeInTheDocument();
    await act(async () => { resolve({ success: true, data }); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(complianceApi.getDashboardStats).toHaveBeenCalledTimes(2);
    view.unmount();
});
