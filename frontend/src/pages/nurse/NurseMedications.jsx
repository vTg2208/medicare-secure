import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { nurseApi } from '../../api/nurseApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const NurseMedications = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [medications, setMedications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        fetchMedications();
    }, []);

    const fetchMedications = async () => {
        try {
            setLoading(true);
            const response = await nurseApi.getMedications();
            if (response && response.success) {
                setMedications(response.data || []);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (medId, newStatus) => {
        try {
            setUpdatingId(medId);
            const response = await nurseApi.updateMedicationStatus(medId, { status: newStatus });

            if (response && response.success) {
                // Optimistically update the UI
                setMedications(meds => meds.map(med =>
                    med.id === medId
                        ? { ...med, status: newStatus, administeredAt: newStatus === 'administered' ? new Date().toISOString() : null }
                        : med
                ));
            }
        } catch (error) {
            // Optionally could revert optimistic update here, but we'll just fetch fresh data
            fetchMedications();
        } finally {
            setUpdatingId(null);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Navigation configuration
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/nurse/dashboard' },
        { id: 'patients', label: 'Assigned Patients', icon: 'group', path: '/nurse/patients' },
        { id: 'vitals', label: 'Vitals & Notes', icon: 'monitor_heart', path: '/nurse/vitals' },
        { id: 'medications', label: 'Medications', icon: 'medication', path: '/nurse/medications' },
        { id: 'schedule', label: 'Shift Schedule', icon: 'calendar_month', path: '/nurse/schedule' },
    ];

    const getStatusStyles = (status) => {
        switch (status) {
            case 'administered':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400';
            case 'refused':
                return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400';
            case 'pending':
            default:
                return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'administered': return 'check_circle';
            case 'refused': return 'cancel';
            case 'pending':
            default: return 'schedule';
        }
    };

    const filteredMedications = medications.filter(m =>
        statusFilter === 'all' || m.status === statusFilter
    );

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                <Brand to={'/nurse/dashboard'} />

                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path === '/nurse/medications' && location.pathname.includes('/nurse/medications'));

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? "bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm"
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${isActive ? '' : ''}`}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/nurse/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl font-medium">
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

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}


                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all">
                    <div>
                        <h1 className="text-2xl font-bold text-accent">Medication Administration</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage eMAR schedule for this shift</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">
                    <div className="max-w-7xl mx-auto space-y-6">

                        {/* Filters */}
                        <div className="flex gap-4 items-center bg-surface dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm w-fit">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all' ? "bg-primary-600 text-white shadow-sm" : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                            >
                                All Due
                            </button>
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors gap-2 flex items-center ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">schedule</span>
                                Pending
                            </button>
                            <button
                                onClick={() => setStatusFilter('administered')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors gap-2 flex items-center ${statusFilter === 'administered' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                Administered
                            </button>
                        </div>

                        {/* Medications Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        ) : filteredMedications.length > 0 ? (
                            <div className="space-y-4">
                                {filteredMedications.map((med, idx) => (
                                    <div
                                        key={med.id}
                                        className="bg-surface dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm hover:shadow transition animate-fade-in-up"
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                            {/* Patient & Drug Info */}
                                            <div className="flex gap-4 items-start md:items-center flex-1">
                                                <div className={`w-12 h-12 rounded-full flex flex-shrink-0 items-center justify-center font-bold text-lg ${med.status === 'administered' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : "bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"}`}>
                                                    {med.patientName.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">{med.medicationName}</h3>
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-600">
                                                            {med.dosage}
                                                        </span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">({med.route})</span>
                                                    </div>
                                                    <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                                        {med.patientName} <span className="mx-1 text-slate-300 dark:text-slate-600">•</span> Room {med.room}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Schedule & Actions */}
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-8">

                                                {/* Time Block */}
                                                <div className="flex flex-col">
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 uppercase tracking-wider">Scheduled</div>
                                                    <div className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-primary-500 text-[18px]">alarm</span>
                                                        {new Date(med.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>

                                                {/* Status / Buttons */}
                                                <div className="flex flex-col items-end min-w-[140px]">
                                                    {med.status === 'pending' ? (
                                                        <div className="flex gap-2 w-full">
                                                            <button
                                                                onClick={() => handleStatusUpdate(med.id, 'administered')}
                                                                disabled={updatingId === med.id}
                                                                className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex justify-center items-center gap-1 disabled:opacity-50"
                                                            >
                                                                {updatingId === med.id ? (
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-line border-t-white"></div>
                                                                ) : (
                                                                    <>
                                                                        <span className="material-symbols-outlined text-[16px]">check</span>
                                                                        Give
                                                                    </>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(med.id, 'refused')}
                                                                disabled={updatingId === med.id}
                                                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                                                                title="Refused"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">close</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-sm font-bold ${getStatusStyles(med.status)}`}>
                                                            <span className="material-symbols-outlined text-[18px]">{getStatusIcon(med.status)}</span>
                                                            <span className="capitalize">{med.status}</span>
                                                        </div>
                                                    )}
                                                    {med.status === 'administered' && med.administeredAt && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                            at {new Date(med.administeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center bg-surface dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                                    <span className="material-symbols-outlined text-[32px] text-slate-400">check_circle</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">All Caught Up</h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                    No medications matching this filter are due at this time.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NurseMedications;
