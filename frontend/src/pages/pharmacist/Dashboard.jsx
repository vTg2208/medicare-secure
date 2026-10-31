import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { pharmacistApi } from '../../api/pharmacistApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const PharmacistDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [stats, setStats] = useState({
        pendingPrescriptions: 0,
        dispensedToday: 0,
        lowStockAlerts: 0,
        refillRequests: 0
    });
    const [recentPrescriptions, setRecentPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const statsResponse = await pharmacistApi.getDashboardStats();
                if (statsResponse?.success) {
                    setStats(statsResponse.data);
                }

                // Get some pending prescriptions to show on dashboard
                const rxResponse = await pharmacistApi.getPrescriptions('pending');
                if (rxResponse?.success && rxResponse.data) {
                    // Just take top 3 for dashboard
                    setRecentPrescriptions(rxResponse.data.slice(0, 3));
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/pharmacist/dashboard' },
        { id: 'prescriptions', label: 'Prescriptions', icon: 'prescriptions', path: '/pharmacist/prescriptions' },
        { id: 'inventory', label: 'Inventory', icon: 'inventory_2', path: '/pharmacist/inventory' },
        { id: 'audit', label: 'Audit Logs', icon: 'history_edu', path: '/pharmacist/audit-logs' }
    ];

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--background-light)] dark:bg-[var(--background-dark)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative">
                {/* Logo Area */}
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/pharmacist/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">Medicare</h1>
                </div>

                {/* Navigation Links */}
                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? 'bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${isActive ? '' : ''}`}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Profile & Logout */}
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/pharmacist/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition rounded-xl font-medium"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                {/* Header (Sticky Header) */}
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md border-b border-transparent transition-all">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Pharmacist Hub</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Welcome back, {user?.firstName} • Lead Pharmacist Dashboard</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-200 dark:border-emerald-800/50">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active Status
                        </div>
                        <ThemeToggle />
                    </div>
                </header>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {/* Pending Prescriptions */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <span className="material-symbols-outlined">pending_actions</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Rx</p>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stats.pendingPrescriptions}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Dispensed Today */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <span className="material-symbols-outlined">check_circle</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Dispensed Today</p>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stats.dispensedToday}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Low Stock Alerts */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Low Stock</p>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stats.lowStockAlerts}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Refill Requests */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                    <span className="material-symbols-outlined">restart_alt</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Refill Requests</p>
                                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white mt-1">{stats.refillRequests}</h3>
                                </div>
                            </div>
                        </div>
                    </div> {/* End Stats Grid */}

                    {/* Quick Access Area */}
                    <div className="grid grid-cols-1 gap-8 mb-8">
                        {/* Urgent Pending Prescriptions Panel */}
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-sm overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Prescriptions</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Pending queue highlights</p>
                                </div>
                                <button
                                    onClick={() => navigate('/pharmacist/prescriptions')}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                                >
                                    View All
                                </button>
                            </div>

                            {recentPrescriptions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-slate-500 dark:text-slate-400 flex-1">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">task_alt</span>
                                    <p>All caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin">
                                    {recentPrescriptions.map((rx) => (
                                        <div key={rx.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{rx.medication}</h4>
                                                </div>
                                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                    Pending
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400 block text-xs">Patient</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{rx.patientName}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-slate-400 block text-xs">Rx by</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{rx.prescribedBy}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div> {/* End Lower Grid */}
                </div>
            </main>

            {/* Right Sidebar */}
            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 glass-panel flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative">
                <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Quick Actions</h3>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <button onClick={() => navigate('/pharmacist/prescriptions')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-blue-500 text-xl">medication</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Dispense Rx</span>
                    </button>
                    <button onClick={() => navigate('/pharmacist/inventory')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-amber-500 text-xl">inventory_2</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Check Stock</span>
                    </button>
                    <button onClick={() => navigate('/pharmacist/audit-logs')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-purple-500 text-xl">history_edu</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">View Logs</span>
                    </button>
                    <button onClick={() => navigate('/pharmacist/profile')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-emerald-500 text-xl">manage_accounts</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">My Profile</span>
                    </button>
                </div>

                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50 flex flex-col items-center text-center mt-auto">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                        <span className="material-symbols-outlined text-xl">notifications_active</span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Action Items</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        You have {stats.pendingPrescriptions} prescriptions pending and {stats.lowStockAlerts} low stock alerts today.
                    </p>
                </div>
            </aside>
        </div>
    );
};

export default PharmacistDashboard;
