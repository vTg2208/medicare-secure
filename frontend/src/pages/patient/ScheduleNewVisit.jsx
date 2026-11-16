import ThemeToggle from '../../components/common/ThemeToggle';
import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api/visitApi'; // Ensure correct import path
import { userApi } from '../../api/userApi'; // Added to fetch doctors
import DoctorSelectionPopup from '../../components/visit/DoctorSelectionPopup';
import DoctorProfilePopup from '../../components/visit/DoctorProfilePopup';
import FlowSteps from '../../components/common/FlowSteps';
import ScrollableNav from '../../components/common/ScrollableNav';

const ScheduleNewVisit = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        hospitalCode: '',
        reason: '',
        symptoms: '',
        doctorId: '',
        scheduledTime: undefined
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
    const [appointment, setAppointment] = useState(null);
    const [draftAppointment, setDraftAppointment] = useState(null);
    const pickerRef = useRef(null);
    const bookedDoctor = doctors.find(doctor => doctor.id === formData.doctorId);

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

return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 p-4 lg:p-8">
            <div className="max-w-[1440px] mx-auto glass-panel rounded-3xl min-h-[90vh] shadow-sm flex overflow-hidden mc-workspace mc-visit-flow">
                {/* Left Sidebar */}
                <aside className="w-64 border-r border-line dark:border-slate-800/50 p-6 flex flex-col mc-sidebar">
                    <Brand to={'/patient/dashboard'} />
                    <ScrollableNav className="space-y-2 flex-grow">
                        <button onClick={() => navigate('/patient/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                            Dashboard
                        </button>
                        <button onClick={() => navigate('/patient/visits')} className="w-full flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-lg font-medium text-slate-800 dark:text-slate-800">
                            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                            Appointments
                        </button>
                        <button onClick={() => navigate('/patient/messages')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                            Messages
                        </button>
                        <button onClick={() => navigate('/patient/medical-records')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                            Records
                        </button>
                        <button onClick={() => navigate('/patient/consent')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">verified_user</span>
                            Consents
                        </button>
                    </ScrollableNav>
                    <div className="space-y-2 mt-auto pt-6 border-t border-line dark:border-slate-800/50">
                        <button onClick={() => navigate('/patient/support')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                            Support
                        </button>
                        <ThemeToggle />
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-grow min-w-0 p-4 md:p-8 flex flex-col items-center gap-6 overflow-y-auto">
                    <button
                        onClick={() => navigate('/patient/visits')}
                        className="self-start flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Back to Visits
                    </button>

                    <div className="w-full max-w-lg glass-card rounded-3xl p-4 sm:p-8 border border-line dark:border-slate-700/50 shadow-sm relative overflow-hidden group">



                        <div className="relative z-10">
                            <div className="flex flex-col items-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4 shadow-inner">
                                    <span className="material-symbols-outlined text-3xl">add_circle</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">Request a New Visit</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm text-center">Request a visit with any available doctor, or optionally choose a doctor and clinic appointment.</p>
                            </div>
                            <FlowSteps label="Booking progress" steps={appointment ? [{ label: 'Doctor' }, { label: 'Appointment' }, { label: 'Request' }] : [{ label: 'Request' }]} currentStep={appointment ? 2 : 0} />

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
                                    <label htmlFor="visit-hospital" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Hospital Code</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="visit-hospital"
                                            name="hospitalCode"
                                            value={formData.hospitalCode}
                                            onChange={handleChange}
                                            placeholder="e.g. 100001"
                                            maxLength="6"
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-slate-900 dark:text-white shadow-sm"
                                        />
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">local_hospital</span>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="visit-doctor" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Select Doctor (Optional)</label>
                                    <button
                                        id="visit-doctor"
                                        aria-label={`Select doctor (optional): ${fetchingDoctors ? 'Loading doctors' : bookedDoctor ? `Dr. ${bookedDoctor.firstName} ${bookedDoctor.lastName}` : 'Any Available Doctor'}`}
                                        ref={pickerRef}
                                        type="button"
                                        disabled={fetchingDoctors}
                                        onClick={() => !fetchingDoctors && setShowDoctorSelection(true)}
                                        className={`relative w-full py-3 px-4 bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl transition-all shadow-sm flex items-center justify-between cursor-pointer hover:bg-surface dark:hover:bg-slate-800 ${fetchingDoctors ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-sm">stethoscope</span>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-medium">
                                                {fetchingDoctors ? 'Loading doctors...' : (bookedDoctor ? `Dr. ${bookedDoctor.firstName} ${bookedDoctor.lastName}` : 'Any Available Doctor')}
                                            </span>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                    </button>
                                    {appointment ? <div className="mt-3 text-sm mc-booking-summary">
                                        <p className="font-semibold">Selected appointment: {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: appointment.timeZone || 'UTC' }).format(new Date(appointment.scheduledTime))} ({appointment.timeZone || 'UTC'})</p>
                                        <p className="mt-1">Reserved when you submit this request.</p>
                                        <button type="button" className="mt-2 underline" onClick={() => { setAppointment(null); setDraftAppointment(null); setSelectedDoctor(null); setFormData(current => ({ ...current, doctorId: '', scheduledTime: undefined })); }}>Use any available doctor instead</button>
                                    </div> : <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Choosing a doctor and appointment is optional.</p>}
                                </div>

                                <div>
                                    <label htmlFor="visit-reason" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Reason for Visit</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="visit-reason"
                                            name="reason"
                                            value={formData.reason}
                                            onChange={handleChange}
                                            placeholder="e.g. Regular Checkup"
                                            required
                                            className="w-full pl-11 pr-4 py-3 bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-slate-900 dark:text-white shadow-sm"
                                        />
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">info</span>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="visit-symptoms" className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">Symptoms</label>
                                    <div className="relative">
                                        <textarea
                                            id="visit-symptoms"
                                            name="symptoms"
                                            value={formData.symptoms}
                                            onChange={handleChange}
                                            placeholder="Describe how you're feeling (optional)"
                                            rows="3"
                                            className="w-full pl-11 pr-4 py-3 bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all resize-none text-slate-900 dark:text-white shadow-sm"
                                        />
                                        <span className="material-symbols-outlined absolute left-4 top-4 text-slate-400">monitor_heart</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-4 rounded-lg shadow-lg shadow-primary-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:translate-y-0 flex items-center justify-center gap-2"
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
                    initialDoctorId={selectedDoctor?.id}
                    returnFocusRef={pickerRef}
                    onClose={() => setShowDoctorSelection(false)}
                    onSelect={(doctor) => {
                        if (doctor.id !== selectedDoctor?.id) setDraftAppointment(null);
                        setSelectedDoctor(doctor);
                        setShowDoctorSelection(false);
                        setShowDoctorProfile(true);
                    }}
                />
            )}

            {showDoctorProfile && (
                <DoctorProfilePopup
                    key={selectedDoctor.id}
                    doctor={selectedDoctor}
                    initialAppointment={draftAppointment || appointment}
                    returnFocusRef={pickerRef}
                    onBack={(draft) => {
                        setDraftAppointment(draft);
                        setShowDoctorProfile(false);
                        setShowDoctorSelection(true);
                    }}
                    onBook={(bookingDetails) => {
                        setAppointment(bookingDetails);
                        setDraftAppointment(bookingDetails);
                        setFormData({
                            ...formData,
                            doctorId: bookingDetails.doctorId,
                            scheduledTime: bookingDetails.scheduledTime
                        });
                        setShowDoctorProfile(false);
                    }}
                />
            )}
        </div>
    );
};

export default ScheduleNewVisit;
