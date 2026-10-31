import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { visitApi } from '../../api/visitApi';
import { consentApi } from '../../api/consentApi';
import EmergencyToggle from '../../components/emergency/EmergencyToggle';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Dashboard.css';

const NAV_CARDS = [
    {
        title: 'Patient Records',
        description: 'Access and manage patient medical records with consent verification',
        path: '/doctor/patients',
        icon: 'folder_shared',
        color: 'indigo',
    },
    {
        title: 'Consultation Queue',
        description: 'View scheduled appointments and manage consultation workflow',
        path: '/doctor/active-visits',
        icon: 'calendar_today',
        color: 'teal',
    },
    {
        title: 'AI Pre-Screening',
        description: 'Review AI-generated triage summaries and patient severity scores',
        path: '/doctor/triage-sessions',
        icon: 'smart_toy',
        color: 'indigo',
    },
    {
        title: 'Consent Requests',
        description: 'Review and manage patient data access consent requests',
        path: '/doctor/consent',
        icon: 'verified_user',
        color: 'amber',
    },
    {
        title: 'Clinical Notes',
        description: 'Create and update patient consultation notes and prescriptions',
        path: '/doctor/notes',
        icon: 'edit_note',
        color: 'rose',
    },
];

const COLOR_MAP = {
    indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/30',
        text: 'text-indigo-600 dark:text-indigo-400',
        hover: 'group-hover:text-indigo-500',
        accent: 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100/50 dark:border-indigo-500/10',
    },
    teal: {
        bg: 'bg-teal-50 dark:bg-teal-900/30',
        text: 'text-teal-600 dark:text-teal-400',
        hover: 'group-hover:text-teal-500',
        accent: 'bg-teal-50/50 dark:bg-teal-900/20 border-teal-100/50 dark:border-teal-500/10',
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-900/30',
        text: 'text-amber-600 dark:text-amber-400',
        hover: 'group-hover:text-amber-500',
        accent: 'bg-amber-50/50 dark:bg-amber-900/20 border-amber-100/50 dark:border-amber-500/10',
    },
    rose: {
        bg: 'bg-rose-50 dark:bg-rose-900/30',
        text: 'text-rose-600 dark:text-rose-400',
        hover: 'group-hover:text-rose-500',
        accent: 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-100/50 dark:border-rose-500/10',
    },
};

function DoctorDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [stats, setStats] = useState([
        { label: "Today's Patients", value: '0', icon: 'groups' },
        { label: 'Pending Consents', value: '0', icon: 'assignment' },
        { label: 'Active Cases', value: '0', icon: 'favorite' },
        { label: 'Consultations', value: '0', icon: 'chat_bubble_outline' },
    ]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [visitRes, consentRes] = await Promise.all([
                    visitApi.getActiveVisits(),
                    consentApi.getDoctorPatients()
                ]);

                if (visitRes.success) {
                    const visits = visitRes.data || [];
                    const activeCount = visits.filter(v => ['checked_in', 'in_progress'].includes(v.status)).length;
                    const consultationCount = visits.filter(v => v.status === 'in_progress').length;
                    const pendingConsents = consentRes.success ? (consentRes.data?.length || 0) : 0;

                    setStats([
                        { label: "Today's Patients", value: visits.length.toString(), icon: 'groups' },
                        { label: 'Pending Consents', value: pendingConsents.toString(), icon: 'assignment' },
                        { label: 'Active Cases', value: activeCount.toString(), icon: 'favorite' },
                        { label: 'Consultations', value: consultationCount.toString(), icon: 'chat_bubble_outline' },
                    ]);
                }
            } catch (error) {
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="doctor-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/doctor/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>

                <nav className="space-y-2 flex-grow">
                    <Link to="/doctor/dashboard" className="flex items-center gap-3 px-4 py-3 doctor-sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/doctor/patients" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/doctor/active-visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Queue
                    </Link>
                    <Link to="/doctor/triage-sessions" className="flex items-center gap-3 px-4 py-3 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px] animate-pulse">smart_toy</span>
                        AI Pre-Screening
                    </Link>
                    <Link to="/doctor/consent" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/doctor/notes" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">edit_note</span>
                        Clinical Notes
                    </Link>
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
                    <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Doctor Portals</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Dr. {user?.firstName} {user?.lastName} • License: {user?.licenseNumber || 'N/A'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 doctor-glass-card px-4 py-2 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Active Physician</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {NAV_CARDS.map((card) => {
                            const c = COLOR_MAP[card.color];
                            return (
                                <div
                                    key={card.title}
                                    onClick={() => navigate(card.path)}
                                    className="doctor-glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center justify-between mb-6">
                                        <div className={`w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center ${c.text}`}>
                                            <span className="material-symbols-outlined text-2xl">{card.icon}</span>
                                        </div>
                                        <span className={`material-symbols-outlined text-slate-300 dark:text-slate-600 ${c.hover} transition-colors`}>arrow_forward</span>
                                    </div>
                                    <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">{card.title}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Clinical Services</p>
                                    <div className={`${c.accent} p-4 rounded-2xl border`}>
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{card.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-8">
                    <section>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
                            Recent Patient Activity
                        </h4>
                        <div className="doctor-glass-card rounded-3xl p-6 space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8 italic">No recent patient activities reported.</p>
                        </div>
                    </section>
                    <section>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <span className="w-1 h-5 bg-teal-500 rounded-full inline-block" />
                            Upcoming Consultations
                        </h4>
                        <div className="doctor-glass-card rounded-3xl p-6 text-center py-10">
                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">event_note</span>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your schedule for today is currently clear.</p>
                        </div>
                    </section>
                </div>
            </main>

            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 doctor-glass-panel flex flex-col h-full overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">Clinical Pulse</h3>
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500/40" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="doctor-glass-card rounded-2xl p-4 flex flex-col items-center gap-2 border-b-2 border-b-teal-500/20">
                            <span className="material-symbols-outlined text-teal-500 text-xl">{stat.icon}</span>
                            <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{stat.value}</span>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none tracking-wider">{stat.label}</span>
                        </div>
                    ))}
                </div>

                {/* Clinical Efficiency */}
                <h3 className="text-sm font-black mb-4 text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">analytics</span>
                    Efficiency Metrics
                </h3>
                <div className="space-y-4 mb-8">
                    <div className="doctor-glass-card p-4 rounded-2xl">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                            <span>Avg. Consultation</span>
                            <span className="text-teal-500">14.2 min</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: '65%' }} />
                        </div>
                    </div>
                    <div className="doctor-glass-card p-4 rounded-2xl">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                            <span>Patient Satisfaction</span>
                            <span className="text-teal-500">4.9/5.0</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: '92%' }} />
                        </div>
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Care Protocols</h3>
                <div className="doctor-glass-card rounded-2xl p-6 mb-8 border-l-4 border-l-rose-500 bg-rose-50/10">
                    <EmergencyToggle />
                    <p className="text-[10px] text-slate-400 mt-4 leading-relaxed font-medium tracking-tight uppercase">Emergency override grants read-access to critical patient EMRs. System-wide audit active.</p>
                </div>

                <div className="mt-auto pt-6">
                    <div className="bg-gradient-to-br from-teal-600 to-sky-700 rounded-3xl p-6 text-white relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full group-hover:scale-150 transition-transform duration-700" />
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Clinic Status</p>
                        <h4 className="text-xl font-black italic mb-3">Optimal Flow</h4>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <p className="text-[10px] font-medium opacity-90">All systems verified</p>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}

export default DoctorDashboard;
