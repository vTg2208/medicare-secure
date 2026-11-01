import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complianceApi } from '../../api/complianceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const GlobalAuditLogs = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const response = await complianceApi.getGlobalAudits();
            if (response && response.success) {
                setLogs(response.data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/compliance/dashboard' },
        { id: 'audits', label: 'Global Audits', icon: 'policy', path: '/compliance/global-audits' },
        { id: 'incidents', label: 'Incidents', icon: 'gavel', path: '/compliance/incidents' },
        { id: 'overrides', label: 'Consent Overrides', icon: 'key_off', path: '/compliance/consent-overrides' },
        { id: 'privacy', label: 'Privacy Requests', icon: 'privacy_tip', path: '/compliance/privacy' }
    ];

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                {/* Logo Area */}
                <Brand to={'/compliance/dashboard'} />

                {/* Navigation Links */}
                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Profile & Logout */}
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/compliance/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition rounded-lg font-medium"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}


                {/* Header */}
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2 text-accent">
                            <span className="material-symbols-outlined">policy</span> Global Security Audit Logs
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Immutable record of all system data access and events</p>
                    </div>
                </header>

                {/* Right Floating Theme Toggle */}
                <div className="absolute top-6 right-8 z-[60]">
                    <ThemeToggle />
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide flex flex-col">

                    {/* Filters & Actions Area (Mock) */}
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Search by User, Action, ID..."
                                className="w-full pl-10 pr-4 py-2.5 bg-surface dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 dark:text-white"
                            />
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-surface dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-medium dark:text-slate-200">
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            Filter
                        </button>
                    </div>

                    {/* Logs List */}
                    <div className="bg-surface dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm flex-1 flex flex-col relative z-10">
                        {loading && logs.length === 0 && (
                            <div className="absolute inset-0 bg-surface dark:bg-slate-900/50 z-20 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                            </div>
                        )}

                        <div className="overflow-x-auto p-2">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800/80">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 rounded-tl-xl whitespace-nowrap">Timestamp</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Initator</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 whitespace-nowrap">Action Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 w-full">Event Details</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 text-right rounded-tr-xl">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group text-sm"
                                        >
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                {formatDate(log.timestamp)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                    {log.user.split('(')[0].trim()}
                                                </div>
                                                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                                                    {log.user.includes('(') ? log.user.split('(')[1].replace(')', '') : 'UNKNOWN'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 h-full">
                                                <span className="inline-block px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                {log.details}
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1">Ref: {log.id}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${log.status === 'Failed' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' :
                                                    log.status === 'Warning' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' :
                                                        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                                    }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">receipt_long</span>
                                                No audit logs to display.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default GlobalAuditLogs;
