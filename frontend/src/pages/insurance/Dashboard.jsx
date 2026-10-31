import Brand from '../../components/common/Brand';
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import insuranceApi from '../../api/insuranceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const navItems = [
    { label: 'Dashboard', icon: 'grid_view', path: '/insurance/dashboard' },
    { label: 'Claims', icon: 'receipt_long', path: '/insurance/claims' },
    { label: 'Coverage Check', icon: 'verified_user', path: '/insurance/coverage' },
    { label: 'Policyholders', icon: 'group', path: '/insurance/policyholders' },
];

function InsuranceDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useContext(AuthContext);

    const [stats, setStats] = useState({ pendingClaims: 0, approvedClaims: 0, deniedClaims: 0, totalPayout: '0.00', activePolicies: 0 });
    const [recentClaims, setRecentClaims] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await insuranceApi.getDashboardStats();
                if (res.success) {
                    const { recentClaims: rc, ...statData } = res.data;
                    setStats(statData);
                    setRecentClaims(rc || []);
                }
            } catch (e) {
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };


    const statCards = [
        { label: 'Pending Claims', value: stats.pendingClaims, icon: 'pending_actions', color: 'amber' },
        { label: 'Approved Claims', value: stats.approvedClaims, icon: 'check_circle', color: 'emerald' },
        { label: 'Denied Claims', value: stats.deniedClaims, icon: 'cancel', color: 'rose' },
        { label: 'Active Policies', value: stats.activePolicies, icon: 'policy', color: 'indigo' },
    ];

    const colorMap = {
        amber: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        rose: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
    };

    const statusBadge = (status) => {
        const map = {
            Pending: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
            Approved: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
            Denied: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
        };
        return map[status] || 'bg-slate-100 text-slate-600';
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/insurance/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    {navItems.map(item => (
                        <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${location.pathname === item.path ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/insurance/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
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
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Insurance Hub</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {user?.firstName} {user?.lastName} — {stats.activePolicies} Active Policies
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Online</span>
                        </div>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {statCards.map(card => (
                            <div key={card.label} className="glass-card p-5 rounded-3xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${colorMap[card.color]}`}>
                                        <span className="material-symbols-outlined">{card.icon}</span>
                                    </div>
                                </div>
                                <h4 className="text-3xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '…' : card.value}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">{card.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Total Payout Banner */}
                    <div className="glass-card p-6 rounded-3xl mb-8 flex items-center gap-6 border border-primary-100 dark:border-primary-800/30 bg-primary-50 dark:bg-primary-900/20">
                        <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                            <span className="material-symbols-outlined text-3xl">payments</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-1">Total Approved Payout</p>
                            <h3 className="text-4xl font-bold text-slate-900 dark:text-white">${loading ? '…' : stats.totalPayout}</h3>
                        </div>
                    </div>

                    {/* Recent Claims */}
                    <div className="glass-card rounded-3xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/60">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Claims</h3>
                            <Link to="/insurance/claims" className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">View All →</Link>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {recentClaims.length === 0 && !loading && (
                                <div className="py-10 text-center text-slate-400">No recent claims</div>
                            )}
                            {recentClaims.map(claim => (
                                <div key={claim.id} className="flex items-center justify-between px-6 py-4 hover:bg-surface dark:hover:bg-surface transition">
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{claim.patientName}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{claim.diagnosis} · {claim.policyNumber}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-slate-700 dark:text-slate-200">${claim.amount.toFixed(2)}</span>
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBadge(claim.status)}`}>{claim.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Right Quick-Action Sidebar */}
            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 glass-panel flex flex-col h-full overflow-y-auto">
                <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3 mb-8">
                    {[
                        { icon: 'receipt_long', label: 'Claims', path: '/insurance/claims', color: "text-primary-500" },
                        { icon: 'verified_user', label: 'Verify', path: '/insurance/coverage', color: "text-primary-500" },
                        { icon: 'group', label: 'Members', path: '/insurance/policyholders', color: "text-primary-500" },
                        { icon: 'manage_accounts', label: 'Profile', path: '/insurance/profile', color: "text-primary-500" },
                    ].map(a => (
                        <button key={a.label} onClick={() => navigate(a.path)} className="glass-card flex flex-col items-center gap-2 p-4 rounded-lg hover:shadow-md transition-all group">
                            <span className={`material-symbols-outlined ${a.color} text-xl`}>{a.icon}</span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">{a.label}</span>
                        </button>
                    ))}
                </div>

                <div className="glass-card rounded-2xl p-4 mt-auto">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Agent Info</p>
                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-300 text-xl font-bold mx-auto mb-3">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <p className="text-sm font-bold text-center text-slate-700 dark:text-slate-200">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-center text-slate-400 mt-1">BlueCross Health</p>
                </div>
            </aside>
        </div>
    );
}

export default InsuranceDashboard;
