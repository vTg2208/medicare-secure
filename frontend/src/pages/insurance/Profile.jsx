import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import insuranceApi from '../../api/insuranceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const navItems = [
    { label: 'Dashboard', icon: 'grid_view', path: '/insurance/dashboard' },
    { label: 'Claims', icon: 'receipt_long', path: '/insurance/claims' },
    { label: 'Coverage Check', icon: 'verified_user', path: '/insurance/coverage' },
    { label: 'Policyholders', icon: 'group', path: '/insurance/policyholders' },
];

function InsuranceProfile() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useContext(AuthContext);

    const [profile, setProfile] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await insuranceApi.getProfile();
                if (res.success) { setProfile(res.data); setForm(res.data); }
            } catch (e) { undefined; }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await insuranceApi.updateProfile(form);
            if (res.success) { setProfile(res.data); setSaved(true); setEditMode(false); setTimeout(() => setSaved(false), 3000); }
        } catch (e) { undefined; }
        finally { setSaving(false); }
    };



    const initials = (profile?.firstName?.[0] || profile?.email?.[0] || '?').toUpperCase();
    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.email || 'Insurance Agent';

    if (loading) {
        return (
            <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] flex items-center justify-center h-screen">
                <div className="flex flex-col items-center gap-4 text-slate-400">
                    <span className="material-symbols-outlined text-5xl animate-spin">refresh</span>
                    <p className="text-sm font-medium">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/insurance/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    {navItems.map(item => (
                        <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${location.pathname === item.path ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'}`}>
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/insurance/profile" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${location.pathname === '/insurance/profile' ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'}`}>
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-grow p-8 overflow-y-auto h-full">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Agent Profile</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your account information</p>
                    </div>
                    <div>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Avatar Card */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 p-8 text-center">
                            <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mx-auto flex items-center justify-center mb-4 border-4 border-white dark:border-slate-700 shadow-md">
                                <span className="text-3xl font-bold uppercase">{initials}</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{fullName}</h3>
                            <div className="flex items-center justify-center gap-2 mt-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    ACTIVE
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                                {profile?.role || 'Insurance Agent'}
                            </p>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {profile?.company || 'Medicare'}
                            </p>
                        </div>
                        <div className="glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 p-6 text-center">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Agent ID</h4>
                            <p className="text-lg font-mono text-slate-600 dark:text-slate-300">{profile?.agentId || 'AGNT-0000000'}</p>
                        </div>
                    </div>

                    {/* Right Column - Form */}
                    <div className="lg:col-span-2">
                        <div className="glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Personal Information</h3>
                                </div>
                                <div className="flex gap-3">
                                    {saved && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-semibold">
                                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                            Saved!
                                        </div>
                                    )}
                                    {editMode ? (
                                        <>
                                            <button onClick={() => setEditMode(false)} className="px-4 py-2 rounded-xl glass-card text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-white/70 transition">Cancel</button>
                                            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70">
                                                {saving ? <span className="material-symbols-outlined animate-spin text-[16px]">refresh</span> : <span className="material-symbols-outlined text-[16px]">check</span>}
                                                {saving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => setEditMode(true)} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                            Edit
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">First Name</label>
                                        {editMode ? (
                                            <input type="text" value={form.firstName || ''} onChange={e => setForm({ ...form, firstName: e.target.value })} className="w-full px-5 py-3.5 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium" />
                                        ) : (
                                            <div className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 font-medium">{profile?.firstName || '—'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Last Name</label>
                                        {editMode ? (
                                            <input type="text" value={form.lastName || ''} onChange={e => setForm({ ...form, lastName: e.target.value })} className="w-full px-5 py-3.5 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium" />
                                        ) : (
                                            <div className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 font-medium">{profile?.lastName || '—'}</div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                                    <input type="email" value={profile?.email || ''} disabled className="w-full px-5 py-3.5 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 cursor-not-allowed font-medium" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Phone</label>
                                        {editMode ? (
                                            <input type="text" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-5 py-3.5 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium" />
                                        ) : (
                                            <div className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 font-medium">{profile?.phone || '—'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 ml-1">Department</label>
                                        {editMode ? (
                                            <input type="text" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-5 py-3.5 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/50 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-medium" />
                                        ) : (
                                            <div className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 font-medium">{profile?.department || '—'}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default InsuranceProfile;
