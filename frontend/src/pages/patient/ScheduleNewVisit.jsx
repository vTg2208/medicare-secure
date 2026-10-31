import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api/visitApi'; // Ensure correct import path
import { userApi } from '../../api/userApi'; // Added to fetch doctors
import DoctorSelectionPopup from '../../components/visit/DoctorSelectionPopup';
import DoctorProfilePopup from '../../components/visit/DoctorProfilePopup';

const ScheduleNewVisit = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        hospitalCode: '',
        reason: '',
        symptoms: '',
        doctorId: ''
    });
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingDoctors, setFetchingDoctors] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Popup states
    const [showDoctorSelection, setShowDoctorSelection] = useState(false);
    const [showDoctorProfile, setShowDoctorProfile] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState(null);

    useEffect(() => {
        const fetchDoctorsList = async () => {
            setFetchingDoctors(true);
            try {
                const response = await userApi.getDoctors();
                if (response.data && Array.isArray(response.data)) {
                    setDoctors(response.data);
                } else {
                    setDoctors([]); // Fallback
                }
            } catch (err) {
                // Non-fatal error for the form, we just might have an empty list or let user type it eventually if API goes down.
            } finally {
                setFetchingDoctors(false);
            }
        };

        fetchDoctorsList();
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await visitApi.createVisit(formData);
            setSuccess('Visit requested successfully!');
            setTimeout(() => {
                navigate('/patient/dashboard');
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to request visit');
        } finally {
            setLoading(false);
        }
    };

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark');
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 p-4 lg:p-8">
            <div className="max-w-[1440px] mx-auto glass-panel rounded-3xl min-h-[90vh] shadow-2xl flex overflow-hidden">
                {/* Left Sidebar */}
                <aside className="w-64 border-r border-white/20 dark:border-slate-800/50 p-6 flex flex-col hidden md:flex">
                    <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => navigate('/patient/dashboard')}>
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-sm">local_hospital</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">Medicare</h1>
                    </div>
                    <nav className="space-y-2 flex-grow">
                        <button onClick={() => navigate('/patient/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                            Dashboard
                        </button>
                        <button onClick={() => navigate('/patient/visits')} className="w-full flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                            Appointments
                        </button>
                        <button onClick={() => navigate('/patient/messages')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                            Messages
                        </button>
                        <button onClick={() => navigate('/patient/medical-records')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                            Records
                        </button>
                        <button onClick={() => navigate('/patient/consent')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">verified_user</span>
                            Consents
                        </button>
                    </nav>
                    <div className="space-y-2 mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
                        <button onClick={() => navigate('/patient/support')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                            Support
                        </button>
                        <button onClick={toggleDarkMode} className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500 !block dark:!hidden">dark_mode</span>
                            <span className="material-symbols-outlined text-amber-500 !hidden dark:!block">light_mode</span>
                            <span className="!block dark:!hidden">Dark Mode</span>
                            <span className="!hidden dark:!block">Light Mode</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-grow p-4 md:p-8 flex items-center justify-center relative overflow-y-auto">
                    <button
                        onClick={() => navigate('/patient/visits')}
                        className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Back to Visits
                    </button>

                    <div className="w-full max-w-lg glass-card rounded-3xl p-8 border border-white/50 dark:border-slate-700/50 shadow-xl relative overflow-hidden group">
                        <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex flex-col items-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-inner">
                                    <span className="material-symbols-outlined text-3xl">add_circle</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">Request a New Visit</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm text-center">Fill out the details below to schedule an appointment with your preferred doctor.</p>
                            </div>

                            {error && (
                                <div className="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                                    <span className="material-symbols-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Hospital Code</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="hospitalCode"
                                            value={formData.hospitalCode}
                                            onChange={handleChange}
                                            placeholder="e.g. 100001"
                                            maxLength="6"
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white shadow-sm backdrop-blur-sm"
                                        />
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">local_hospital</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Select Doctor (Optional)</label>
                                    <div
                                        onClick={() => !fetchingDoctors && setShowDoctorSelection(true)}
                                        className={`relative w-full py-3 px-4 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl transition-all shadow-sm backdrop-blur-sm flex items-center justify-between cursor-pointer hover:bg-white dark:hover:bg-slate-800 ${fetchingDoctors ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm">stethoscope</span>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-medium">
                                                {fetchingDoctors ? 'Loading doctors...' : (selectedDoctor ? `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}` : 'Any Available Doctor')}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Reason for Visit</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="reason"
                                            value={formData.reason}
                                            onChange={handleChange}
                                            placeholder="e.g. Regular Checkup"
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white shadow-sm backdrop-blur-sm"
                                        />
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">info</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Symptoms</label>
                                    <div className="relative">
                                        <textarea
                                            name="symptoms"
                                            value={formData.symptoms}
                                            onChange={handleChange}
                                            placeholder="Describe how you're feeling (optional)"
                                            rows="3"
                                            className="w-full pl-11 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none text-slate-900 dark:text-white shadow-sm backdrop-blur-sm"
                                        />
                                        <span className="material-symbols-outlined absolute left-4 top-4 text-slate-400">monitor_heart</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin text-sm">refresh</span>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-sm">send</span>
                                                Submit Request
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>

            {/* Popups */}
            {showDoctorSelection && (
                <DoctorSelectionPopup
                    doctors={doctors}
                    onClose={() => setShowDoctorSelection(false)}
                    onSelect={(doctor) => {
                        setSelectedDoctor(doctor);
                        setShowDoctorSelection(false);
                        setShowDoctorProfile(true);
                    }}
                />
            )}

            {showDoctorProfile && (
                <DoctorProfilePopup
                    doctor={selectedDoctor}
                    onBack={() => {
                        setShowDoctorProfile(false);
                        setShowDoctorSelection(true);
                    }}
                    onBook={(bookingDetails) => {
                        setFormData({
                            ...formData,
                            doctorId: bookingDetails.doctorId
                        });
                        setShowDoctorProfile(false);
                    }}
                />
            )}
        </div>
    );
};

export default ScheduleNewVisit;
