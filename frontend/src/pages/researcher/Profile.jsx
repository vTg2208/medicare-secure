import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import { researchApi } from '../../services/researchApi';
import '../patient/Dashboard.css';

function Profile() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await researchApi.getProfile();
            if (response.success) {
                setProfile(response.data);
                setFormData(response.data);
            }
        } catch (error) {
            setLoadError('Unable to load research data. Please reload and retry.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSave = async () => {
        try {
            const response = await researchApi.updateProfile(formData);
            if (response.success) {
                setProfile(response.data);
                setIsEditing(false);
                fetchProfile(); // refresh
            }
        } catch (error) {
            setLoadError('Unable to load research data. Please reload and retry.');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/researcher/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">science</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>

                <nav className="space-y-2 flex-grow">
                    <Link to="/researcher/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">insights</span>
                        Global Stats
                    </Link>
                    <Link to="/researcher/explorer" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">query_stats</span>
                        Data Explorer
                    </Link>
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
                    <Link to="/researcher/profile" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800 shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                {loadError && <p role="alert" className="mb-4 text-rose-600">{loadError}</p>}
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Profile & Settings</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Manage your researcher credentials and contact details
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                        </div>
                    </div>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center h-64 glass-card rounded-3xl">
                        <div className="flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-4xl text-indigo-500 animate-spin">autorenew</span>
                            <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">Securely querying credentials...</p>
                        </div>
                    </div>
                ) : profile && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* ── Left Column — Avatar card ── */}
                        <div className="lg:col-span-1 space-y-4">
                            <div className="glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 p-8 text-center flex flex-col items-center">
                                {/* Avatar */}
                                <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-slate-700 shadow-md">
                                    <span className="text-4xl font-bold">{profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{profile.firstName} {profile.lastName}</h3>

                                {/* Active status below name */}
                                <div className="flex items-center justify-center gap-2 mt-2 mb-3">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                        {profile.status?.toUpperCase() || 'ACTIVE'}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {profile.role}
                                </p>
                            </div>

                            {/* Additional Security or Meta block */}
                            <div className="glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 p-6">
                                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Network Credentials</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl">
                                        <span className="material-symbols-outlined text-teal-500 text-[20px]">badge</span>
                                        <span className="font-medium">{profile.id}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-emerald-500/30">
                                        <span className="material-symbols-outlined text-emerald-500 text-[20px]">verified_user</span>
                                        <span className="font-medium text-emerald-700 dark:text-emerald-400">Research access</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Right Column — Info/Edit form ── */}
                        <div className="lg:col-span-2">
                            <div className="glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 p-8">
                                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200 dark:border-slate-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Institutional Details</h3>
                                    </div>
                                    <div className="flex gap-3">
                                        {isEditing ? (
                                            <>
                                                <button onClick={() => { setIsEditing(false); setFormData(profile); }} className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                                    Cancel
                                                </button>
                                                <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-medium shadow-md shadow-indigo-600/20 transition flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">save</span>
                                                    Save Changes
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-medium transition cursor-pointer border border-slate-200 dark:border-slate-700">
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                Edit Profile
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-indigo-500 text-[20px]">contact_mail</span>
                                            Contact Information
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Email Address</label>
                                                <div className="form-input text-slate-500 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3 font-medium">
                                                    <span className="material-symbols-outlined text-[18px]">mail</span>
                                                    {profile.email}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Phone Number</label>
                                                <div className={`form-input flex items-center gap-3 font-medium transition-colors ${isEditing ? 'bg-white dark:bg-slate-800 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-50 dark:ring-indigo-900/20' : 'bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                    <span className={`material-symbols-outlined text-[18px] ${isEditing ? 'text-indigo-500' : 'text-slate-400'}`}>call</span>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            name="phone"
                                                            value={formData.phone || ''}
                                                            onChange={handleChange}
                                                            className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                                                            placeholder="Enter contact number"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-800 dark:text-slate-200">{profile.phone || 'Not provided'}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-indigo-500 text-[20px]">corporate_fare</span>
                                            Institution Linkage
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Department</label>
                                                <div className={`form-input flex items-center gap-3 font-medium transition-colors ${isEditing ? 'bg-white dark:bg-slate-800 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-50 dark:ring-indigo-900/20' : 'bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                    <span className={`material-symbols-outlined text-[18px] ${isEditing ? 'text-indigo-500' : 'text-slate-400'}`}>schema</span>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            name="department"
                                                            value={formData.department || ''}
                                                            onChange={handleChange}
                                                            className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
                                                            placeholder="Enter department name"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-800 dark:text-slate-200">{profile.department || 'Not provided'}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Institution Name</label>
                                                <div className="form-input text-slate-500 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/30 flex items-center gap-3 font-medium">
                                                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                                                    {profile.institution || 'Not provided'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Profile;
