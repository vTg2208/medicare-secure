import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { nurseApi } from '../../api/nurseApi';
import ThemeToggle from '../../components/common/ThemeToggle';

const NurseSchedule = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [schedule, setSchedule] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchedule = async () => {
            try {
                const response = await nurseApi.getSchedule();
                if (response.success) {
                    setSchedule(response.data);
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        fetchSchedule();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans mc-workspace">
            {/* Sidebar */}
            <aside className="w-72 bg-surface dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 p-8 flex flex-col h-full z-20 mc-sidebar">
                <Brand to={'/nurse/dashboard'} />

                <nav className="flex-grow space-y-2">
                    <Link to="/nurse/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/nurse/patients" className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">group</span>
                        Assigned Patients
                    </Link>
                    <Link to="/nurse/vitals" className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                        Vitals & Notes
                    </Link>
                    <Link to="/nurse/medications" className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">medication</span>
                        Medications
                    </Link>
                    <Link to="/nurse/schedule" className="flex items-center gap-3 px-4 py-3 rounded-xl transition bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm font-medium">
                        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                        Shift Schedule
                    </Link>
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <Link to="/nurse/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                    <div className="flex justify-center pt-2">
                        <ThemeToggle />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow overflow-y-auto bg-slate-50 dark:bg-slate-950 p-10 scrollbar-hide relative">
                <header className="mb-10">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Shift Schedule</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Your clinical assignments and duty roster.</p>
                </header>

                <div className="max-w-4xl">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                        </div>
                    ) : schedule ? (
                        <div className="space-y-8">
                            <div className="bg-surface dark:bg-slate-900/40 p-8 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden">


                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-white shadow-sm shadow-primary-500/20">
                                        <span className="material-symbols-outlined text-3xl">schedule</span>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold">Duty Details</h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">{schedule.organizationName}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Shift Timing</p>
                                        <p className="text-xl font-bold flex items-center gap-2">
                                            {schedule.shift_start} — {schedule.shift_end}
                                            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full">Current Shift</span>
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Shift Preference</p>
                                        <p className="text-xl font-bold">{schedule.shiftPreference || 'Day Shift'}</p>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Assigned Wards / Areas</p>
                                    <div className="flex flex-wrap gap-3">
                                        {schedule.assignedWards && schedule.assignedWards.length > 0 ? (
                                            schedule.assignedWards.map((ward, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-4 py-2 rounded-xl border border-primary-100/50 dark:border-primary-800/20 font-bold text-sm">
                                                    <span className="material-symbols-outlined text-sm">domain</span>
                                                    {ward}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-slate-400 italic">Default assignment: General Ward</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-32 bg-surface dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">event_busy</span>
                            <p className="text-slate-500 font-medium">No assigned schedule found in current mapping.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default NurseSchedule;
