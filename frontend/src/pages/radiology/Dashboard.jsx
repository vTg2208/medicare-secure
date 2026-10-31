import Brand from '../../components/common/Brand';
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
        <div className="radiology-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                <Brand to={'/radiology/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/radiology/dashboard" className="flex items-center gap-3 px-4 py-3 bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/radiology/queue" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">view_list</span>
                        Imaging Queue
                    </Link>
                    <Link to="/radiology/audit-logs" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history_edu</span>
                        Audit Logs
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/radiology/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}


                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all pr-[80px]">
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
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
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
                        <div onClick={() => navigate('/radiology/queue')} className="glass-card p-6 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined text-2xl">view_list</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Imaging Queue</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Worklist Console</p>
                            <div className="bg-primary-50/50 dark:bg-primary-900/20 p-4 rounded-2xl border border-primary-100/50 dark:border-primary-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">Process pending orders</span>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => navigate('/radiology/queue?priority=stat')} className="glass-card p-6 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined text-2xl">bolt</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors">arrow_forward</span>
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

                        <div onClick={() => navigate('/radiology/audit-logs')} className="glass-card p-6 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined text-2xl">history_edu</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Audit Logs</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Security Record</p>
                            <div className="bg-primary-50/50 dark:bg-primary-900/20 p-4 rounded-2xl border border-primary-100/50 dark:border-primary-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-primary-600 text-[18px]">lock_clock</span>
                                    <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">Track access logs</span>
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
