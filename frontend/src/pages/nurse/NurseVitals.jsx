import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { nurseApi } from '../../api/nurseApi';
import ThemeToggle from '../../components/common/ThemeToggle';

const NurseVitals = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [vitals, setVitals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVitals = async () => {
            try {
                const response = await nurseApi.getVitals();
                if (response.success) {
                    setVitals(response.data);
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        fetchVitals();
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
                    <Link to="/nurse/vitals" className="flex items-center gap-3 px-4 py-3 rounded-xl transition bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm font-medium">
                        <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                        Vitals & Notes
                    </Link>
                    <Link to="/nurse/medications" className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-[20px]">medication</span>
                        Medications
                    </Link>
                    <Link to="/nurse/schedule" className="flex items-center gap-3 px-4 py-3 rounded-xl transition text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
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
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Vitals & Clinical Notes</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time patient monitoring and documentation logs.</p>
                </header>

                <div className="max-w-6xl">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                        </div>
                    ) : vitals.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {vitals.map((record) => (
                                <div key={record.id} className="bg-surface dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 hover:border-primary-500/30 transition-all shadow-sm group">
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                                <span className="material-symbols-outlined">
                                                    {record.type === 'note' ? 'monitor_heart' : 'edit_note'}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary-500">{record.patientFirstName} {record.patientLastName}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.patientId}</span>
                                                </div>
                                                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-1 group-hover:text-primary-600 transition-colors uppercase">{record.title}</h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{record.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                {new Date(record.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32 bg-surface dark:bg-slate-900/20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">history_toggle_off</span>
                            <p className="text-slate-500 font-medium">No clinical notes or vitals recorded yet.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default NurseVitals;
