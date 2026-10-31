import ThemeToggle from '../../components/common/ThemeToggle';
import Brand from '../../components/common/Brand';
// Patient Visits Page - Epic 3: Visit Management
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { visitApi } from '../../api/visitApi';
import VisitCard from '../../components/visit/VisitCard';
import CheckInForm from '../../components/visit/CheckInForm';
import DoctorSelectionPopup from '../../components/visit/DoctorSelectionPopup';
import '../patient/Dashboard.css'; // Shared dashboard theme
import './Visits.css';

function Visits() {
    const navigate = useNavigate();
    const { logout } = useContext(AuthContext);
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('upcoming'); // upcoming, past, all
    const [showCheckIn, setShowCheckIn] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showDoctorPopup, setShowDoctorPopup] = useState(false);
    const [doctors] = useState([]);

    const handleScheduleVisit = () => {
        navigate('/patient/visits/schedule');
    };

    const handleDoctorSelect = async (doctor) => {
        try {
            setLoading(true);
            const reason = prompt(`Briefly describe your reason for visiting Dr. ${doctor.firstName} ${doctor.lastName}:`);
            if (!reason) return;

            await visitApi.requestVisit({
                doctorId: doctor.id,
                reason: reason,
                type: 'scheduled',
                status: 'pending'
            });
            setShowDoctorPopup(false);
            setSuccessMessage(`Visit request sent to Dr. ${doctor.firstName} ${doctor.lastName}`);
            fetchVisits();
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to request visit');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVisits();
    }, [filter]);

    const fetchVisits = async () => {
        setLoading(true);
        try {
            const data = await visitApi.getMyVisits();
            setVisits(data || []);  // getMyVisits returns array directly
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async (visitCode) => {
        await visitApi.checkIn(visitCode);
            setSuccessMessage('Successfully checked in! Your visit has been registered.');
            setShowCheckIn(false);
            fetchVisits(); // Refresh visits

            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(''), 5000);
    };

    const filterVisits = () => {
        if (filter === 'upcoming') {
            return visits.filter(v =>
                ['pending', 'approved', 'checked_in', 'in_progress']
                    .includes(v.status?.toLowerCase())
            );
        } else if (filter === 'past') {
            return visits.filter(v =>
                ['completed', 'cancelled']
                    .includes(v.status?.toLowerCase())
            );
        }
        return visits;
    };

    const filteredVisits = filterVisits();

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            {/* Theme Toggle styling */}
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/patient/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <button onClick={() => navigate('/patient/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-lg font-medium text-slate-800 dark:text-slate-800">
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
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-8 overflow-y-auto">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">My Visits</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your appointments and check-ins</p>
                        </div>
                    </div>
                </header>

                {successMessage && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl mb-8 flex items-center gap-3">
                        <span className="material-symbols-outlined">check_circle</span>
                        {successMessage}
                    </div>
                )}

                {/* Check In Section */}
                <div className="glass-card p-6 md:p-8 rounded-3xl mb-8 border border-line dark:border-slate-700/50 relative overflow-hidden group">

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Schedule or Check In</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md">Have a scheduled visit? Enter the code provided by your doctor or nurse to check in.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <button
                                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-primary-600/30 whitespace-nowrap"
                                onClick={handleScheduleVisit}
                            >
                                Schedule a Visit
                            </button>
                            <button
                                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-primary-600/30 whitespace-nowrap"
                                onClick={() => navigate('/patient/visits/new')}
                            >
                                Walk-In Visit
                            </button>
                            <button
                                className="bg-surface dark:bg-slate-800/80 hover:bg-surface dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                                onClick={() => setShowCheckIn(!showCheckIn)}
                            >
                                {showCheckIn ? 'Hide Check-In Form' : 'Check In with Code'}
                            </button>
                        </div>
                    </div>
                </div>

                {showDoctorPopup && (
                    <DoctorSelectionPopup
                        doctors={doctors}
                        onClose={() => setShowDoctorPopup(false)}
                        onSelect={handleDoctorSelect}
                    />
                )}

                {showCheckIn && (
                    <div className="mb-8 p-6 glass-card rounded-3xl">
                        <CheckInForm onCheckIn={handleCheckIn} />
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-8 bg-surface dark:bg-slate-800/40 p-1.5 rounded-2xl inline-flex border border-line dark:border-slate-700/50">
                    <button
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${filter === 'upcoming' ? "bg-surface dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm" : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        onClick={() => setFilter('upcoming')}
                    >
                        Upcoming
                    </button>
                    <button
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${filter === 'past' ? "bg-surface dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm" : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        onClick={() => setFilter('past')}
                    >
                        Past Visits
                    </button>
                    <button
                        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${filter === 'all' ? "bg-surface dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm" : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                </div>

                {/* Visits List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="glass-card rounded-3xl p-12 text-center">
                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 animate-spin mb-4">refresh</span>
                            <p className="text-slate-500 font-medium">Loading visits...</p>
                        </div>
                    ) : filteredVisits.length === 0 ? (
                        <div className="glass-card rounded-3xl p-16 text-center flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 text-slate-400 dark:text-slate-500">
                                <span className="material-symbols-outlined text-4xl">event_busy</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No {filter} visits found</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                                {filter === 'upcoming'
                                    ? 'Schedule an appointment to see it here'
                                    : 'Your visit history will appear here'}
                            </p>
                        </div>
                    ) : (
                        filteredVisits.map(visit => (
                            <div key={visit.id} className="glass-card rounded-3xl overflow-hidden hover:shadow-lg transition-all duration-300 transform">
                                <VisitCard
                                    visit={visit}
                                    userRole="patient"
                                    showActions={false}
                                />
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}

export default Visits;
