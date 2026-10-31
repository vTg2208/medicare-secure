import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import auditApi from '../../api/auditApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';

function AuditTrail() {
    const navigate = useNavigate();
    const {  logout } = useContext(AuthContext);

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50, offset: 0 });

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [actionFilter, startDate, endDate]);

    const fetchAuditLogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = {
                limit: pagination.limit,
                offset: (currentPage - 1) * pagination.limit,
            };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (actionFilter) params.action = actionFilter;

            const result = await auditApi.getMyAuditTrail(params);
            if (result.success) {
                setLogs(result.data.logs);
                setPagination(result.data.pagination);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load audit trail');
        } finally {
            setLoading(false);
        }
    }, [pagination.limit, currentPage, startDate, endDate, actionFilter]);

    useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

    const handleResetFilters = () => {
        setStartDate('');
        setEndDate('');
        setActionFilter('');
        setCurrentPage(1);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatAction = (action) => {
        const actionMap = {
            'VIEW_MEDICAL_RECORD': 'Viewed Medical Record',
            'CREATE_MEDICAL_RECORD': 'Created Medical Record',
            'UPDATE_MEDICAL_RECORD': 'Updated Medical Record',
            'VIEW_PATIENT_RECORDS': 'Viewed Patient Records',
            'GRANT_CONSENT': 'Granted Consent',
            'REVOKE_CONSENT': 'Revoked Consent',
            'view_medical_record': 'Viewed Medical Record',
            'create_medical_record': 'Created Medical Record',
            'update_medical_record': 'Updated Medical Record',
            'view_patient_records': 'Viewed Patient Records',
            'consent_grant': 'Granted Consent',
            'consent_revoke': 'Revoked Consent',
            'consent_view': 'Viewed Consent',
            'consent_expired': 'Consent Expired',
            'create_diagnosis': 'Created Diagnosis',
            'create_prescription': 'Created Prescription',
            'upload_lab_result': 'Uploaded Lab Result',
            'upload_imaging_report': 'Uploaded Imaging Report',
            'user_login': 'User Login',
            'user_register': 'User Registration',
            'create_visit': 'Requested Visit',
            'approve_visit': 'Visit Approved',
            'update_visit': 'Visit Updated',
            'verify_visit_otp': 'Verified Visit OTP',
        };
        return actionMap[action] || action;
    };

    const getActionBadgeClass = (action) => {
        const base = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap ';
        if (action.includes('view') || action.includes('VIEW')) return base + 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50';
        if (action.includes('create') || action.includes('CREATE') || action.includes('upload') || action.includes('UPLOAD')) return base + 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50';
        if (action.includes('update') || action.includes('UPDATE')) return base + 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50';
        if (action.includes('revoke') || action.includes('REVOKE')) return base + 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50';
        if (action.includes('grant') || action.includes('GRANT')) return base + 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50';
        return base + 'bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50';
    };

    const getRoleIcon = (role) => {
        if (!role) return 'person';
        const r = role.toLowerCase();
        if (r === 'doctor') return 'stethoscope';
        if (r === 'nurse') return 'medical_services';
        if (r === 'patient') return 'person';
        if (r === 'admin' || r === 'hospital_admin') return 'admin_panel_settings';
        return 'manage_accounts';
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            setCurrentPage(newPage);
        }
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* ── Sidebar ── */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/patient/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                        Messages
                    </Link>
                    <Link to="/patient/medical-records" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/patient/consent" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/patient/audit-trail" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Audit Trail
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-grow p-8 overflow-y-auto h-full">
                <header className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Audit Trail</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">A full log of who accessed your medical data and when.</p>
                </header>

                {/* Filters */}
                <div className="glass-card rounded-2xl p-5 mb-6 flex flex-wrap gap-4 items-end border border-white/50 dark:border-slate-700/50">
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600/50 bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-none text-sm"
                        />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600/50 bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-none text-sm"
                        />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Action Type</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600/50 bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition outline-none text-sm"
                        >
                            <option value="">All Actions</option>
                            <option value="view_patient_records">Viewed Records</option>
                            <option value="consent_grant">Granted Consent</option>
                            <option value="consent_revoke">Revoked Consent</option>
                            <option value="consent_view">Viewed Consent</option>
                            <option value="create_visit">Requested Visit</option>
                            <option value="approve_visit">Visit Approved</option>
                            <option value="user_login">Login</option>
                        </select>
                    </div>
                    <button
                        onClick={handleResetFilters}
                        className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-600/60 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors border border-slate-200/50 dark:border-slate-600/50 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Reset
                    </button>
                </div>

                {/* Log list */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <span className="material-symbols-outlined text-5xl animate-spin mb-4">refresh</span>
                        <p className="text-sm font-medium">Loading audit logs...</p>
                    </div>
                ) : error ? (
                    <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/50 flex items-center gap-3">
                        <span className="material-symbols-outlined">error</span>
                        {error}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="glass-card rounded-2xl p-16 text-center border border-white/50 dark:border-slate-700/50 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-slate-400">history</span>
                        </div>
                        <p className="text-slate-900 dark:text-white font-bold text-lg mb-2">No audit logs found</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Audit logs will appear here when someone accesses your medical records.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div key={log.id} className="glass-card rounded-2xl border border-white/50 dark:border-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all p-5">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <span className="material-symbols-outlined text-[20px]">{getRoleIcon(log.userRole)}</span>
                                            </div>
                                            <div>
                                                <strong className="block text-slate-900 dark:text-white font-bold text-sm">
                                                    {log.userFirstName && log.userLastName
                                                        ? `${log.userFirstName} ${log.userLastName}`
                                                        : log.userEmail || 'Unknown User'}
                                                </strong>
                                                <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                                    {log.userRole || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={getActionBadgeClass(log.action)}>
                                            {formatAction(log.action)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Time</span>
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatDate(log.timestamp)}</span>
                                        </div>
                                        {log.purpose && (
                                            <div>
                                                <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Purpose</span>
                                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{log.purpose}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {pagination.pages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-8 pt-8 border-t border-slate-200 dark:border-slate-700/50">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600/50 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    ← Previous
                                </button>
                                <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                                    Page {currentPage} of {pagination.pages}
                                    <span className="text-slate-400 dark:text-slate-500 ml-1">({pagination.total} logs)</span>
                                </span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === pagination.pages}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600/50 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default AuditTrail;
