import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complianceApi } from '../../api/complianceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const ComplianceDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [stats, setStats] = useState({
        authAnomalies: 0,
        openIncidents: 0,
        activeOverrides: 0,
        pendingReviews: 0
    });

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                const [statsRes, incidentsRes] = await Promise.all([
                    complianceApi.getDashboardStats(),
                    complianceApi.getIncidents()
                ]);

                if (statsRes.success) setStats(statsRes.data);
                if (incidentsRes.success) {
                    // Just show the most recent/relevant incidents
                    setIncidents(incidentsRes.data.slice(0, 3));
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
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/compliance/dashboard' },
        { id: 'audits', label: 'Global Audits', icon: 'policy', path: '/compliance/global-audits' },
        { id: 'incidents', label: 'Incidents', icon: 'gavel', path: '/compliance/incidents' },
        { id: 'overrides', label: 'Consent Overrides', icon: 'key_off', path: '/compliance/consent-overrides' },
        { id: 'privacy', label: 'Privacy Requests', icon: 'policy', path: '/compliance/privacy' },
        { id: 'retention', label: 'Retention Governance', icon: 'inventory_2', path: '/compliance/retention' }
    ];

    // Format date nicely
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">

            {/* Theme Toggle styling */}
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

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
            <main className="flex-1 overflow-y-auto px-8 py-8 relative h-full scrollbar-hide flex flex-col">

                {/* Decorative background element */}


                <header className="mb-10 flex-shrink-0">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Security & Compliance Hub</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Welcome back, {user?.firstName || 'Officer'} {user?.lastName || ''} • Oversight Dashboard
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-surface dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 px-4 py-2 rounded-2xl shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">System Secure</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-surface dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                            </div>
                            <h4 className="text-3xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.authAnomalies}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Auth Anomalies (24h)</p>
                        </div>

                        <div className="bg-surface dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <span className="material-symbols-outlined">gavel</span>
                                </div>
                            </div>
                            <h4 className="text-3xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.openIncidents}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Open Incidents</p>
                        </div>

                        <div className="bg-surface dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">key_off</span>
                                </div>
                            </div>
                            <h4 className="text-3xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.activeOverrides}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Active Overrides</p>
                        </div>

                        <div className="bg-surface dark:bg-slate-900/80 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm transition hover:shadow-md group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">checklist</span>
                                </div>
                            </div>
                            <h4 className="text-3xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.pendingReviews}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Pending Reviews</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0">
                    {/* Recent Incidents Area */}
                    <div className="bg-surface dark:bg-slate-900/80 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-sm flex flex-col flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Active Privacy Incidents</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Recently reported anomalies require your attention</p>
                            </div>
                            <button
                                onClick={() => navigate('/compliance/incidents')}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                                View All
                            </button>
                        </div>

                        <div className="space-y-4 overflow-y-auto pr-2 scrollbar-thin flex-1">
                            {incidents.length === 0 && !loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">verified_user</span>
                                    <p>No active incidents reported.</p>
                                </div>
                            ) : (
                                incidents.map((incident) => (
                                    <div key={incident.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-surface dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${incident.status === 'Open' ? 'bg-rose-500' :
                                                        incident.status === 'Investigating' ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}></span>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200">{incident.type}</h4>
                                            </div>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${incident.status === 'Open' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' :
                                                    incident.status === 'Investigating' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                                        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                }`}>
                                                {incident.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{incident.description}</p>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">person</span>
                                                Reported by: {incident.reporter}
                                            </span>
                                            <span className="text-slate-400">{formatDate(incident.date)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Right Sidebar for Quick Actions */}
            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col h-full overflow-y-auto z-20 relative">
                <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Quick Actions</h3>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <button onClick={() => navigate('/compliance/global-audits')} className="bg-surface dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <span className="material-symbols-outlined text-primary-500 text-xl">policy</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">View Audits</span>
                    </button>
                    <button onClick={() => navigate('/compliance/consent-overrides')} className="bg-surface dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <span className="material-symbols-outlined text-primary-500 text-xl">key_off</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Overrides</span>
                    </button>
                    <button onClick={() => navigate('/compliance/incidents')} className="bg-surface dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <span className="material-symbols-outlined text-primary-500 text-xl">gavel</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Incidents</span>
                    </button>
                    <button onClick={() => navigate('/compliance/profile')} className="bg-surface dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800/80 shadow-sm rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                        <span className="material-symbols-outlined text-primary-500 text-xl">manage_accounts</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">My Settings</span>
                    </button>
                </div>

                <div className="bg-surface dark:bg-slate-800/80 rounded-2xl p-5 shadow-sm border border-slate-200/80 dark:border-slate-800/80 mt-auto">
                    <div className="flex items-center gap-3 mb-3 text-slate-800 dark:text-slate-200 font-bold text-sm">
                        <span className="material-symbols-outlined text-slate-400">info</span>
                        Compliance Status
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Currently tracking {stats.openIncidents} open incidents and monitoring {stats.pendingReviews} pending action reviews. System stability is categorized as Secure.
                    </p>
                </div>
            </aside>
        </div>
    );
};

export default ComplianceDashboard;
