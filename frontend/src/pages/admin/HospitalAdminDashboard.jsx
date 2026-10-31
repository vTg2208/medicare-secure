import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ThemeToggle from '../../components/common/ThemeToggle';
import apiClient from '../../api/client';
import '../patient/Dashboard.css';

// ─── Shared Admin Sidebar ─────────────────────────────────────────────────────
export function AdminSidebar({ active }) {
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext);

    const links = [
        { to: '/admin/dashboard', icon: 'grid_view', label: 'Overview' },
        { to: '/admin/visits', icon: 'calendar_month', label: 'Visit Management' },
        { to: '/admin/staff', icon: 'manage_accounts', label: 'Staff Management' },
        { to: '/admin/doctor-verification', icon: 'verified_user', label: 'Doctor Verification' },
        { to: '/admin/users', icon: 'group', label: 'User Management' },
        { to: '/admin/audit-logs', icon: 'receipt_long', label: 'Audit Logs' },
    ];

    return (
        <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20">
            <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/admin/dashboard')}>
                <div className="relative">
                    <div className="absolute inset-0 bg-violet-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full" />
                    <div className="relative w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3">
                        <span className="material-symbols-outlined text-xl">local_hospital</span>
                    </div>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Medicare</h1>
            </div>

            <nav className="space-y-1 flex-grow">
                {links.map(link => {
                    const isActive = active === link.to;
                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                ? 'admin-sidebar-item-active text-slate-800 dark:text-slate-800 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
                            {link.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
                <button onClick={logout} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium text-sm">
                    <span className="material-symbols-outlined text-[20px]">logout</span>Sign Out
                </button>
            </div>
        </aside>
    );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
function HospitalAdminDashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [stats, setStats] = useState({ totalStaff: 0, activeDoctors: 0, pendingVisits: 0, totalPatients: 0 });
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiClient.get('/v1/admin/hospital/stats');
                const data = response.data;
                if (data.success) setStats(data.data);
            } catch (err) {
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const navCards = [
        { path: '/admin/staff', icon: 'manage_accounts', color: 'indigo', title: 'Staff Management', desc: 'Invite staff members and manage invitations' },
        { path: '/admin/doctor-verification', icon: 'verified_user', color: 'teal', title: 'Doctor Verification', desc: 'Review and approve doctor registrations' },
        { path: '/admin/users', icon: 'group', color: 'violet', title: 'User Management', desc: 'Manage accounts, roles and access permissions' },
        { path: '/admin/audit-logs', icon: 'receipt_long', color: 'rose', title: 'Audit Logs', desc: 'Review system activity and security trails' },
    ];

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50"><ThemeToggle /></div>

            <AdminSidebar active="/admin/dashboard" />

            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                {/* Header */}
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Hospital Admin Portal</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Hospital Administration &amp; Staff Management</p>
                        </div>
                        <div className="flex items-center gap-3 admin-glass-card px-4 py-2 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.firstName} {user?.lastName}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Full Access</p>
                            </div>
                        </div>
                    </div>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="admin-glass-card p-6 rounded-3xl group">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">manage_accounts</span>
                            </div>
                            <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{statsLoading ? '—' : stats.totalStaff}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">Total Staff</p>
                        </div>
                        <div className="admin-glass-card p-6 rounded-3xl group">
                            <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">stethoscope</span>
                            </div>
                            <p className="text-4xl font-black text-teal-600 dark:text-teal-400 leading-none">{statsLoading ? '—' : stats.activeDoctors}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">Active Doctors</p>
                        </div>
                        <div className="admin-glass-card p-6 rounded-3xl group cursor-pointer" onClick={() => navigate('/admin/visits', { state: { activeTab: 'pending' } })}>
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">pending_actions</span>
                            </div>
                            <p className="text-4xl font-black text-amber-600 dark:text-amber-400 leading-none">{statsLoading ? '—' : stats.pendingVisits}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">Pending Visits</p>
                        </div>
                        <div className="admin-glass-card p-6 rounded-3xl group">
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 group-hover:scale-110 transition-transform">
                                <span className="material-symbols-outlined text-2xl">favorite</span>
                            </div>
                            <p className="text-4xl font-black text-rose-600 dark:text-rose-400 leading-none">{statsLoading ? '—' : stats.totalPatients}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-widest">Total Patients</p>
                        </div>
                    </div>
                </header>

                {/* Main Admin Sections */}
                <div className="grid grid-cols-2 gap-8">
                    <section>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                            <span className="w-1 h-5 bg-violet-500 rounded-full inline-block" />
                            Administrative Grid
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {navCards.map(card => (
                                <div key={card.path} onClick={() => navigate(card.path)} className="admin-glass-card p-6 rounded-3xl cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all group flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl bg-${card.color}-100 dark:bg-${card.color}-900/30 flex items-center justify-center text-${card.color}-600 dark:text-${card.color}-400 flex-shrink-0 group-hover:rotate-6 transition-transform`}>
                                            <span className="material-symbols-outlined text-2xl">{card.icon}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{card.title}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{card.desc}</p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors flex-shrink-0 ml-4 group-hover:translate-x-1">arrow_forward</span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                            <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block" />
                            System Health
                        </h3>
                        <div className="admin-glass-card rounded-3xl p-8 text-center space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-emerald-500 text-3xl animate-bounce">check_circle</span>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-slate-800 dark:text-white">All Systems Operational</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Version 2.4.0 • Uptime: 99.9%</p>
                                </div>
                            </div>
                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                    <span className="text-slate-400">Database Node</span>
                                    <span className="text-emerald-500">Connected</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                    <span className="text-slate-400">Auth Service</span>
                                    <span className="text-emerald-500">Online</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                    <span className="text-slate-400">Security Engine</span>
                                    <span className="text-emerald-500">Encrypted</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 admin-glass-panel flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">System Intel</h3>
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
                    </div>
                </div>

                {/* System Resilience */}
                <div className="space-y-4 mb-8">
                    <div className="admin-glass-card p-4 rounded-2xl border-b-2 border-b-violet-500/20">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Integrity</span>
                            <span className="text-[10px] font-bold text-emerald-500">99.98%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '99%' }} />
                        </div>
                    </div>

                    <div className="admin-glass-card p-4 rounded-2xl border-b-2 border-b-indigo-500/20">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Encryption Load</span>
                            <span className="text-[10px] font-bold text-indigo-500">Optimal</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '42%' }} />
                        </div>
                    </div>
                </div>

                <h3 className="text-sm font-black mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">terminal</span>
                    Live Audit Feed
                </h3>
                <div className="space-y-3 mb-8">
                    <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Staff Invitation Protocol</p>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">Admin initiated secure handshake for role: <span className="text-violet-500">NURSE</span></p>
                        <p className="text-[9px] text-slate-400 mt-2 font-mono">T-SEC: 12:45:02</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Visit Validation Success</p>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">System verified OTP signature for Visit ID: <span className="text-emerald-500">#4492</span></p>
                        <p className="text-[9px] text-slate-400 mt-2 font-mono">T-SEC: 12:38:15</p>
                    </div>
                </div>

            </aside>
        </div>
    );
}

export default HospitalAdminDashboard;
