import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './HospitalAdminDashboard';
import ThemeToggle from '../../components/common/ThemeToggle';
import Button from '../../components/common/Button';
import apiClient from '../../api/client';
import '../patient/Dashboard.css';

const ACTION_COLORS = {
    'visit_approval': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'approve_visit': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'verify_visit_otp': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'consent_grant': 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    'emr_access': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'update_visit': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'staff_onboard': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'create_lab_order': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'create_imaging_order': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'create_medication_order': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'user_login': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'user_logout': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'view_medical_record': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'create_medical_record': 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    'create_visit': 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    'staff_deactivate': 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

function AuditLogs() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true); setError(null);
            const response = await apiClient.get('/audit/logs');
            const data = response.data;
            if (data.success) setLogs(data.data || []);
            else { setError(data.message || 'Failed to fetch logs'); setLogs([]); }
        } catch (error) {
            setError(error.response?.data?.message || 'Failed to connect to the server');
            setLogs([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.details?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAction = filterAction === 'all' || log.action === filterAction;
        let matchesDate = true;
        if (dateRange.start) matchesDate = matchesDate && new Date(log.timestamp) >= new Date(dateRange.start);
        if (dateRange.end) matchesDate = matchesDate && new Date(log.timestamp) <= new Date(dateRange.end);
        return matchesSearch && matchesAction && matchesDate;
    });

    const formatTimestamp = (timestamp) => new Date(timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const hasFilters = searchTerm || filterAction !== 'all' || dateRange.start || dateRange.end;

    const selectCls = "px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme"><ThemeToggle /></div>
            <AdminSidebar active="/admin/audit-logs" />

            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">System Audit Logs</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Comprehensive system activity and security audit trails</p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-surface dark:hover:bg-slate-800 transition-all text-sm font-bold shadow-sm group"
                    >
                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        Back to Dashboard
                    </button>
                </div>

                {/* Filters */}
                <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800 mb-6 flex flex-wrap gap-3 items-center">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
                    <input
                        type="text"
                        placeholder="Search by user, action, or details..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`flex-grow min-w-[200px] ${selectCls}`}
                    />
                    <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className={selectCls}>
                        <option value="all">All Actions</option>
                        <option value="user_login">User Login</option>
                        <option value="create_visit">Requested Visit</option>
                        <option value="approve_visit">Visit Approved</option>
                        <option value="create_medical_record">Created Record</option>
                        <option value="view_medical_record">Viewed Record</option>
                        <option value="visit_approval">Visit Approval (Legacy)</option>
                        <option value="consent_grant">Consent Grant</option>
                        <option value="emr_access">EMR Access</option>
                        <option value="staff_onboard">Staff Onboard</option>
                        <option value="staff_deactivate">Staff Deactivate</option>
                    </select>
                    <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className={selectCls} />
                    <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className={selectCls} />
                    {hasFilters && (
                        <Button onClick={() => { setSearchTerm(''); setFilterAction('all'); setDateRange({ start: '', end: '' }); }} variant="outline">
                            Reset
                        </Button>
                    )}
                </div>

                {/* Summary badge */}
                {!loading && !error && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Showing <span className="font-bold text-slate-800 dark:text-white">{filteredLogs.length}</span> of <span className="font-bold">{logs.length}</span> log entries
                    </p>
                )}

                {/* Table */}
                <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400">
                            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-8">
                            <span className="material-symbols-outlined text-4xl text-rose-400">error</span>
                            <p className="text-rose-500 font-medium">{error}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Please ensure you are logged in as an administrator.</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                            <span className="material-symbols-outlined text-4xl">receipt_long</span>
                            <p className="text-sm">No audit logs found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Timestamp</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">User</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Action</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Resource</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Details</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">IP Address</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs font-mono">{formatTimestamp(log.timestamp)}</td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium">{log.user_email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                    {log.action?.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{log.resource}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">{log.details}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{log.ip_address}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default AuditLogs;
