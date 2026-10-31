import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { consentApi } from '../../api/consentApi';
import { visitApi } from '../../api/visitApi';
import { emrApi } from '../../api/emrApi';
import { patientApi } from '../../api/patientApi';
import { auditApi } from '../../api/auditApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Dashboard.css';

function PatientDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [stats, setStats] = useState({
        activeConsents: 0,
        medicalRecords: 0,
        scheduledVisits: 0,
        accessLogs: 0
    });
    const [patientDetails, setPatientDetails] = useState(null);
    const [healthFacts, setHealthFacts] = useState([]);
    const [activities, setActivities] = useState([]);
    const [activityPage, setActivityPage] = useState(0);
    const ACTIVITIES_PER_PAGE = 3;

    const [activeVisit, setActiveVisit] = useState(null);
    const [queueStatus, setQueueStatus] = useState(null);
    const [dashboardSearch, setDashboardSearch] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            if (!user?.id) return;

            try {
                const [consentsRes, recordsRes, visitsRes, profileRes, factsRes, activitiesRes, auditRes] = await Promise.allSettled([
                    consentApi.getActiveConsents(),
                    emrApi.getPatientMedicalRecords(user.id),
                    visitApi.getMyVisits(),
                    patientApi.getProfile(),
                    patientApi.getHealthFacts(),
                    patientApi.getActivities(),
                    auditApi.getMyAuditTrail({ limit: 1 })
                ]);

                if (profileRes.status === 'fulfilled') setPatientDetails(profileRes.value?.data || profileRes.value);
                if (factsRes.status === 'fulfilled') setHealthFacts(factsRes.value?.data || factsRes.value || []);
                if (activitiesRes.status === 'fulfilled') setActivities(activitiesRes.value?.data || activitiesRes.value || []);

                setStats({
                    activeConsents: consentsRes.status === 'fulfilled'
                        ? (Array.isArray(consentsRes.value)
                            ? consentsRes.value.length
                            : (Array.isArray(consentsRes.value?.data) ? consentsRes.value.data.length : 0))
                        : 0,
                    medicalRecords: recordsRes.status === 'fulfilled' ? (recordsRes.value?.data?.records?.length || recordsRes.value?.data?.length || 0) : 0,
                    scheduledVisits: visitsRes.status === 'fulfilled' ? (visitsRes.value?.filter(v => ['approved', 'pending', 'scheduled'].includes(v.status?.toLowerCase())).length || 0) : 0,
                    accessLogs: auditRes.status === 'fulfilled' ? (auditRes.value?.data?.pagination?.total || auditRes.value?.data?.logs?.length || auditRes.value?.data?.length || 0) : 0
                });

                if (visitsRes.status === 'fulfilled' && Array.isArray(visitsRes.value)) {
                    const latestActive = visitsRes.value.find(v => ['pending', 'approved', 'checked_in', 'in_progress'].includes(v.status?.toLowerCase()));
                    if (latestActive) {
                        setActiveVisit(latestActive);
                        try {
                            const queueRes = await visitApi.getQueueStatus(latestActive.id);
                            if (queueRes.success) {
                                setQueueStatus(queueRes.data);
                            }
                        } catch (err) {
                        }
                    }
                }
            } catch (error) {
            }
        };

        fetchStats();
    }, [user?.id]);

    const totalActivityPages = Math.ceil(activities.length / ACTIVITIES_PER_PAGE);

    const handleNextActivityPage = () => {
        if (activityPage < totalActivityPages - 1) setActivityPage(p => p + 1);
    };

    const handlePrevActivityPage = () => {
        if (activityPage > 0) setActivityPage(p => p - 1);
    };

    const currentActivities = activities.slice(
        activityPage * ACTIVITIES_PER_PAGE,
        (activityPage + 1) * ACTIVITIES_PER_PAGE
    );

    // Format date nicely
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const handleDashboardSearch = (e) => {
        if (e.key === 'Enter' && dashboardSearch.trim()) {
            navigate(`/patient/medical-records?search=${encodeURIComponent(dashboardSearch.trim())}`);
        }
    };

    const handleSpecialtyClick = (specialty) => {
        navigate(`/patient/medical-records?search=${encodeURIComponent(specialty)}`);
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">

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
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/chatbot" className="flex items-center gap-3 px-4 py-3 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px] animate-pulse">smart_toy</span>
                        AI Pre-Screening
                    </Link>
                    <Link to="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
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
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
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

            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Patient Hub</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                {patientDetails?.firstName || user?.firstName || 'Patient Name'} {patientDetails?.lastName || user?.lastName || ''} • Patient ID: {patientDetails?.id || user?.id || 'N/A'}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <div className={`w-2 h-2 rounded-full ${patientDetails?.status === 'active' || user?.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">
                                    {patientDetails?.status || user?.status || 'Active'} Status
                                </span>
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div onClick={() => navigate('/patient/consent')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <span className="material-symbols-outlined text-2xl">verified_user</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Consent Management</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Privacy &amp; Permissions</p>
                            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Active Consents</span>
                                    <span className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg truncate max-w-[120px]">{stats.activeConsents || 0} GRANTED</span>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => navigate('/patient/medical-records')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                                    <span className="material-symbols-outlined text-2xl">folder_shared</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Patient Records</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Medical History</p>
                            <div className="bg-teal-50/50 dark:bg-teal-900/20 p-4 rounded-2xl border border-teal-100/50 dark:border-teal-500/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-teal-700 dark:text-teal-400">View your records</span>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => navigate('/patient/visits')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <span className="material-symbols-outlined text-2xl">assignment_ind</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Visit Management</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Appointments &amp; Queue</p>
                            <div className="bg-amber-50/50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100/50 dark:border-amber-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-amber-600 text-sm">event</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{stats.scheduledVisits} Scheduled Upcoming</span>
                                </div>
                            </div>
                        </div>

                        <div onClick={() => navigate('/patient/audit-trail')} className="glass-card p-6 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                    <span className="material-symbols-outlined text-2xl">history_edu</span>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-rose-500 transition-colors">arrow_forward</span>
                            </div>
                            <h4 className="text-lg font-bold mb-1 text-slate-800 dark:text-slate-100">Access Logs</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-4">Security Audit</p>
                            <div className="bg-rose-50/50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-500/10">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-rose-600 text-sm">lock_clock</span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Track Access Logs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="grid grid-cols-2 gap-8">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Health Facts</h4>
                        </div>
                        <div className="glass-card rounded-3xl p-6 space-y-6">
                            {healthFacts.map((fact, index) => (
                                <div key={index} className="flex gap-4 items-start">
                                    <div>
                                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100">{fact.title}</h5>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{fact.description}</p>
                                    </div>
                                </div>
                            ))}
                            {healthFacts.length === 0 && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No health facts available currently.</p>
                            )}
                        </div>
                    </section>
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Activity History</h4>
                            {activities.length > 0 && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePrevActivityPage}
                                        disabled={activityPage === 0}
                                        className={`w-8 h-8 flex items-center justify-center glass-card rounded-full hover:bg-white dark:hover:bg-slate-700 transition ${activityPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-300">chevron_left</span>
                                    </button>
                                    <button
                                        onClick={handleNextActivityPage}
                                        disabled={activityPage >= totalActivityPages - 1}
                                        className={`w-8 h-8 flex items-center justify-center glass-card rounded-full hover:bg-white dark:hover:bg-slate-700 transition ${activityPage >= totalActivityPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-300">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="glass-card rounded-3xl p-6">
                            <div className="space-y-6">
                                {currentActivities.map((activity) => (
                                    <div key={activity.id} className={`relative pl-6 border-l-2 ${activity.borderColorClass || 'border-indigo-500/30'}`}>
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${activity.colorClass || 'bg-indigo-500'} border-4 border-white dark:border-slate-800`}></div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-tighter mb-1">{activity.type}</p>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{activity.title}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium">{formatDate(activity.date)}</span>
                                        </div>
                                    </div>
                                ))}
                                {activities.length === 0 && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No recent activity found.</p>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 glass-panel flex flex-col h-full overflow-y-auto">
                <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Search Records</h3>
                <div className="relative mb-8">
                    <input
                        className="w-full bg-white dark:bg-slate-800/50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm text-slate-800 dark:text-slate-100"
                        placeholder="Search files, tests..."
                        type="text"
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        onKeyDown={handleDashboardSearch}
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-10">
                    <div onClick={() => handleSpecialtyClick('General')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">add</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase">General</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Pediatrics')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">child_care</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Peds</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('OBGYN')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">favorite</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">OBGYN</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Internal Medicine')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">monitor_heart</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Internal</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Dermatology')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">spa</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Derma</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Mental Health')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">psychology</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Mental</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Cardiology')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">favorite_border</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Cardio</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Orthopedics')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">hardware</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Ortho</span>
                    </div>
                    <div onClick={() => handleSpecialtyClick('Infectious Disease')} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-white/10 transition">
                        <span className="material-symbols-outlined text-indigo-500 text-xl">security</span>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-300 uppercase text-center leading-none">Disease</span>
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">Visit Queue</h3>

                {activeVisit ? (
                    <>
                        <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm mb-4 border border-white/50 dark:border-slate-700/50 text-slate-800 dark:text-slate-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Organization</p>
                                    <p className="text-sm font-bold">{activeVisit.organizationName || 'Hospital'}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {activeVisit.doctor_first_name ? `Dr. ${activeVisit.doctor_first_name} ${activeVisit.doctor_last_name}` : 'Awaiting Assignment'}
                                    </p>
                                    {activeVisit.specialization && (
                                        <p className="text-[10px] text-indigo-500 font-medium mt-0.5">{activeVisit.specialization}</p>
                                    )}
                                </div>
                                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400`}>
                                    {activeVisit.status}
                                </span>
                            </div>
                        </div>

                        {queueStatus && queueStatus.total > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="glass-card rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Status</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">{queueStatus.status}</span>
                                </div>
                                <div className="glass-card rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Order</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{queueStatus.position} <span className="text-[10px] text-slate-400 font-normal">of {queueStatus.total}</span></span>
                                </div>
                                <div className="glass-card rounded-2xl p-3 flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Wait Time</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">~{queueStatus.eta_minutes}m</span>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card rounded-2xl p-4 text-center mt-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Queue</span>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-1">
                                    {activeVisit.status === 'pending' ? 'Waiting for admin approval' : 'Your doctor will see you shortly.'}
                                </p>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-white/50 dark:bg-slate-800/30 rounded-2xl p-6 text-center border border-white/50 dark:border-slate-700/50">
                        <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 mb-2">event_busy</span>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No active visits in queue</p>
                        <button
                            onClick={() => navigate('/patient/visits/new')}
                            className="mt-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline"
                        >
                            Walk-In Clinic / QR Sync
                        </button>
                    </div>
                )}

                <div className="mt-auto hidden">
                </div>
            </aside>
        </div>
    );
}

export default PatientDashboard;