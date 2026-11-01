import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { userApi } from '../../api/userApi';
import PasskeySetupCard from '../../components/common/PasskeySetupCard';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';
import './Profile.css';

function Profile() {
    const { user, logout, login } = useContext(AuthContext);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await userApi.getProfile();
                if (response.success) {
                    const u = response.data.user;
                    setFormData({
                        firstName: u.firstName || u.first_name || '',
                        lastName: u.lastName || u.last_name || '',
                        phone: u.phone || ''
                    });
                }
            } catch (err) {
                setError('Failed to load profile information');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const response = await userApi.updateProfile(formData);
            if (response.success) {
                setSuccess('Profile updated successfully');
                const u = response.data;
                const token = localStorage.getItem('token');
                login({ ...user, firstName: u.firstName || u.first_name, lastName: u.lastName || u.last_name, phone: u.phone }, token);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const initials = (user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase();
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Patient';

    if (loading) {
        return (
            <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] flex items-center justify-center h-screen mc-workspace">
                <div className="flex flex-col items-center gap-4 text-slate-400">
                    <span className="material-symbols-outlined text-5xl animate-spin">refresh</span>
                    <p className="text-sm font-medium">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            {/* Theme Toggle */}
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            {/* ── Left Sidebar ── */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/patient/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                        Messages
                    </Link>
                    <Link to="/patient/medical-records" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/patient/consent" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/patient/audit-trail" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Audit Trail
                    </Link>
                    {(user?.role || user?.roleName || '').toLowerCase() === 'patient' && <Link to="/patient/privacy" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface transition rounded-xl"><span className="material-symbols-outlined text-[20px]">policy</span>Privacy Center</Link>}
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    {/* Profile = Settings (active) */}
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-grow p-8 overflow-y-auto h-full">
                <header className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Patient Profile</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your personal information and account security.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── Left Column — Avatar card ── */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="glass-card rounded-3xl border border-line dark:border-slate-700/50 p-8 text-center">
                            {/* Avatar */}
                            <div className="w-24 h-24 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full mx-auto flex items-center justify-center mb-4 border-4 border-line dark:border-slate-700 shadow-md">
                                <span className="text-3xl font-bold uppercase">{initials}</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{fullName}</h3>
                            {/* Active status below name */}
                            <div className="flex items-center justify-center gap-2 mt-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    {user?.status?.toUpperCase() || 'ACTIVE'}
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                {user?.role?.replace('_', ' ')}
                            </p>
                        </div>

                        {/* Security / Passkey */}
                        <div className="glass-card rounded-3xl border border-line dark:border-slate-700/50 p-6">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Security</h4>
                            <PasskeySetupCard />
                        </div>
                    </div>

                    {/* ── Right Column — Edit form ── */}
                    <div className="lg:col-span-2">
                        <div className="glass-card rounded-3xl border border-line dark:border-slate-700/50 p-8">
                            <div className="flex items-center gap-2 mb-8">
                                <div className="w-1.5 h-6 bg-primary-500 rounded-full"></div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Personal Information</h3>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 flex items-center gap-3 text-sm">
                                    <span className="material-symbols-outlined text-[18px]">error</span>
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-3 text-sm">
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                    {success}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">First Name</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className="w-full px-5 py-3.5 bg-surface dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-medium"
                                            placeholder="Enter first name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Last Name</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className="w-full px-5 py-3.5 bg-surface dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-medium"
                                            placeholder="Enter last name"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address (Read-only)</label>
                                    <input
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="w-full px-5 py-3.5 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 cursor-not-allowed font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Phone Number</label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full px-5 py-3.5 bg-surface dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all font-medium"
                                        placeholder="e.g. +1 234 567 890"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className={`w-full md:w-auto px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg shadow-primary-500/25 active:translate-y-0 transition-all flex items-center justify-center gap-2 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {saving ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-[18px]">check</span>
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Profile;
