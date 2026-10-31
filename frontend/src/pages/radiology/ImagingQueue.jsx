import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import radiologyApi from '../../api/radiologyApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import './RadiologyDashboard.css';

const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'completed'];

const STATUS_LABELS = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
};

const getImagingIcon = (type) => {
    switch (type) {
        case 'MRI': return 'radio';
        case 'CT Scan': return 'monitor';
        case 'X-Ray': return 'bolt';
        case 'Ultrasound': return 'waves';
        default: return 'image';
    }
};

function ImagingQueue() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {  logout } = useContext(AuthContext);

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeFilter, setActiveFilter] = useState(
        searchParams.get('priority') === 'stat' ? 'pending' : 'all'
    );
    const [statOnly] = useState(searchParams.get('priority') === 'stat');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const filters = activeFilter !== 'all' ? { status: activeFilter } : {};
            if (statOnly) filters.priority = 'stat';

            const result = await radiologyApi.getOrders(filters);

            if (result?.success && result.data) {
                setOrders(result.data);
            } else {
                setOrders([]);
            }
        } catch (err) {
            setError('Could not connect to backend to fetch orders.');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [activeFilter, statOnly]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const filteredAndSearchedOrders = orders.filter(o =>
        o.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.imagingType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.bodyPart.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    };

    return (
        <div className="radiology-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                <Brand to={'/radiology/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/radiology/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/radiology/queue" className="flex items-center gap-3 px-4 py-3 bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm rounded-xl font-medium">
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
                        <h2 className="text-2xl font-bold text-accent">
                            {statOnly ? 'STAT Imaging Orders' : 'Imaging Queue'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Assigned cases to be reviewed and reported</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between glass-card p-4 rounded-2xl mb-8">
                        <div className="relative w-full sm:w-96">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                            <input
                                type="text"
                                placeholder="Search exact order..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-surface dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-shadow dark:text-white"
                            />
                        </div>

                        <div className="flex gap-2">
                            {STATUS_FILTERS.map(f => (
                                <button
                                    key={f}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === f
                                        ? "bg-primary-600 text-white shadow-md shadow-primary-500/20"
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                        }`}
                                    onClick={() => setActiveFilter(f)}
                                >
                                    {f === 'all' ? 'All Orders' : STATUS_LABELS[f]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="max-w-7xl">
                        {/* Error Graphic */}
                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-sm flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-[20px]">error</span>
                                {error}
                            </div>
                        )}

                        {/* Queue List */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin"></div>
                                <p className="text-slate-500 dark:text-slate-400 mt-4 font-medium">Loading imaging queue...</p>
                            </div>
                        ) : filteredAndSearchedOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-4xl text-slate-400">sentiment_dissatisfied</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No matching orders</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm">No imaging orders match the current filters or search query.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredAndSearchedOrders.map((order) => (
                                    <div key={order.id} className="glass-card p-6 rounded-2xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all group flex flex-col lg:flex-row lg:items-center justify-between gap-6 cursor-pointer">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center flex-shrink-0 text-primary-500 dark:text-primary-400 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                                                <span className="material-symbols-outlined text-[28px]">{getImagingIcon(order.imagingType)}</span>
                                            </div>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{order.patientName}</h3>
                                                    {order.priority === 'stat' && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">STAT</span>
                                                    )}
                                                    {order.priority === 'urgent' && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Urgent</span>
                                                    )}
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">
                                                    {order.imagingType} — <span className="text-slate-500 dark:text-slate-400">{order.bodyPart}</span>
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {formatDate(order.orderedAt)}</span>
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">local_hospital</span> {order.visitId}</span>
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">person</span> {order.orderedBy}</span>
                                                </div>
                                                {order.clinicalNotes && (
                                                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Notes:</span> {order.clinicalNotes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row items-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 pt-4 lg:pt-0 lg:pl-6">
                                            <div className="text-center sm:text-right min-w-[120px]">
                                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${order.status === 'completed'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                    : order.status === 'in_progress'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                                    }`}>
                                                    {STATUS_LABELS[order.status] || order.status}
                                                </span>
                                            </div>
                                            {order.status !== 'completed' && (
                                                <button
                                                    onClick={() => navigate(`/radiology/upload?orderId=${order.id}&visitId=${order.visitId}&patient=${encodeURIComponent(order.patientName)}&type=${encodeURIComponent(order.imagingType)}`)}
                                                    className="w-full sm:w-auto px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-primary-600/20 flex items-center justify-center gap-2"
                                                >
                                                    Upload Report
                                                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                                </button>
                                            )}
                                            {order.status === 'completed' && (
                                                <div className="w-full sm:w-auto px-5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-medium flex items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                                                    Report Filed
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ImagingQueue;
