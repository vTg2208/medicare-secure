import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import radiologyApi from '../../api/radiologyApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import './RadiologyDashboard.css';

function RadiologistDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);

    const [stats, setStats] = useState({
        pendingReads: 0,
        inProgress: 0,
        completedToday: 0,
        priorityCases: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const response = await radiologyApi.getStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="radiology-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/radiology/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    <Link to="/radiology/dashboard" className="flex items-center gap-3 px-4 py-3 bg-indigo-50/80 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 shadow-sm rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/radiology/queue" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">view_list</span>
                        Imaging Queue
                    </Link>
                    <Link to="/radiology/audit-logs" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history_edu</span>
                        Audit Logs
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/radiology/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Radiologist Hub</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            Dr. {user?.firstName} {user?.lastName} • Radiologist
                        </p>
                    </div>
                    <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">On Duty</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <span className="material-symbols-outlined">assignment</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.pendingReads}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Pending Reads</p>
                        </div>

                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <span className="material-symbols-outlined">hourglass_empty</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.inProgress}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">In Progress</p>
                        </div>

                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <span className="material-symbols-outlined">check_circle</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.completedToday}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Completed Today</p>
                        </div>

                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.priorityCases}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Priority Cases</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div onClick={() => navigate('/radiology/queue')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <span className="material-symbols-outlined text-2xl">view_list</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Imaging Queue</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Worklist Console</p>
                            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Process pending orders</span>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => navigate('/radiology/queue?priority=stat')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                    <span className="material-symbols-outlined text-2xl">bolt</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-rose-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">STAT Orders</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Urgent Attention</p>
                            <div className="bg-rose-50/50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-rose-600 text-[18px]">warning</span>
                                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">Requires immediate read</span>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => navigate('/radiology/audit-logs')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                    <span className="material-symbols-outlined text-2xl">history_edu</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Audit Logs</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Security Record</p>
                            <div className="bg-teal-50/50 dark:bg-teal-900/20 p-4 rounded-2xl border border-teal-100/50 dark:border-teal-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-teal-600 text-[18px]">lock_clock</span>
                                    <span className="text-sm font-semibold text-teal-700 dark:text-teal-400">Track access logs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default RadiologistDashboard;
