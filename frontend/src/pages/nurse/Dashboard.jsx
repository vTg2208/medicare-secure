import Brand from '../../components/common/Brand';
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { nurseApi } from '../../api/nurseApi';
import ThemeToggle from '../../components/common/ThemeToggle';
// We don't strictly need a dedicated CSS file if we use Tailwind utilities like Dashboard.css
import '../../pages/patient/Dashboard.css'; // Reusing the global styles for consistency

function NurseDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);

    const [stats, setStats] = useState({
        assignedPatients: 0,
        vitalsRecorded: 0,
        careTasks: 0,
        observations: 0
    });

    const [assignedPatients, setAssignedPatients] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNurseData = async () => {
            try {
                const [statsRes, patientsRes, activitiesRes] = await Promise.allSettled([
                    nurseApi.getDashboardStats(),
                    nurseApi.getAssignedPatients(),
                    nurseApi.getActivities()
                ]);

                if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
                    setStats(statsRes.value.data);
                }
                if (patientsRes.status === 'fulfilled' && patientsRes.value?.success) {
                    setAssignedPatients(patientsRes.value.data);
                }
                if (activitiesRes.status === 'fulfilled' && activitiesRes.value?.success) {
                    setActivities(activitiesRes.value.data);
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };

        fetchNurseData();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Format date nicely
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/nurse/dashboard'} />

                <nav className="space-y-2 flex-grow">
                    <Link to="/nurse/dashboard" className="flex items-center gap-3 px-4 py-3 bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/nurse/patients" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">group</span>
                        Assigned Patients
                    </Link>
                    <Link to="/nurse/vitals" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                        Vitals &amp; Notes
                    </Link>
                    <Link to="/nurse/medications" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">medication</span>
                        Medications
                    </Link>
                    <Link to="/nurse/schedule" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                        Shift Schedule
                    </Link>
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-line dark:border-slate-800/50">
                    <Link to="/nurse/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Nurse Hub</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Welcome back, {user?.firstName || 'Nurse'} {user?.lastName || ''} • RN-2024-56789
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                </div>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">On Duty</span>
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">group</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.assignedPatients}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Assigned Patients</p>
                        </div>

                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">monitor_heart</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.vitalsRecorded}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Vitals Recorded</p>
                        </div>

                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">check_circle</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.careTasks}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Care Tasks</p>
                        </div>

                        <div className="glass-card p-5 rounded-3xl group transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                    <span className="material-symbols-outlined">edit_note</span>
                                </div>
                            </div>
                            <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100">{loading ? '...' : stats.observations}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Observations</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-8">
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Recent Activities</h4>
                        </div>
                        <div className="glass-card rounded-3xl p-6">
                            <div className="space-y-6">
                                {activities.length > 0 ? activities.map((activity) => (
                                    <div key={activity.id} className={`relative pl-6 border-l-2 ${activity.borderColorClass || "border-primary-500/30"}`}>
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${activity.colorClass || "bg-primary-500"} border-4 border-line dark:border-slate-800`}></div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase tracking-tighter mb-1">{activity.type}</p>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{activity.title}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium">{formatDate(activity.date)}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">No recent activities found.</p>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <aside className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800/50 p-6 glass-panel flex flex-col h-full overflow-y-auto">
                <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-slate-100">Quick Actions</h3>
                <div className="relative mb-6">
                    <input className="w-full bg-surface dark:bg-slate-800/50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary-500 shadow-sm text-slate-800 dark:text-slate-100" placeholder="Search patients..." type="text" />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <button
                        onClick={() => navigate('/nurse/vitals')}
                        className="glass-card rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-surface dark:hover:bg-surface transition"
                    >
                        <span className="material-symbols-outlined text-primary-500 text-xl">monitor_heart</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Add Vitals</span>
                    </button>
                    <button
                        onClick={() => navigate('/nurse/vitals')}
                        className="glass-card rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-surface dark:hover:bg-surface transition"
                    >
                        <span className="material-symbols-outlined text-primary-500 text-xl">edit_note</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Quick Note</span>
                    </button>
                    <button
                        onClick={() => navigate('/nurse/medications')}
                        className="glass-card rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-surface dark:hover:bg-surface transition"
                    >
                        <span className="material-symbols-outlined text-primary-500 text-xl">medication</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Record Meds</span>
                    </button>
                    <button
                        onClick={() => navigate('/nurse/patients')}
                        className="glass-card rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-surface dark:hover:bg-surface transition"
                    >
                        <span className="material-symbols-outlined text-primary-500 text-xl">warning</span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase leading-none">Alert Doctor</span>
                    </button>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Upcoming Checks</h3>
                    <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-[10px] font-bold px-2 py-1 rounded-lg uppercase">{assignedPatients.length} Waiting</span>
                </div>

                <div className="space-y-3">
                    {assignedPatients.length > 0 ? assignedPatients.map((patient) => (
                        <div key={patient.id} className="bg-surface dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-line dark:border-slate-700/50 cursor-pointer hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Room {patient.room}</p>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{patient.firstName} {patient.lastName}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">{patient.condition}</p>
                                </div>
                                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-lg ${patient.status === 'attention' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    patient.status === 'critical' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    }`}>
                                    {formatDate(patient.nextCheck)}
                                </span>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-6 glass-card rounded-2xl">
                            <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 mb-2">hotel</span>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No immediate checks</p>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}

export default NurseDashboard;
