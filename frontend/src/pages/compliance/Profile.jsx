import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complianceApi } from '../../api/complianceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const Profile = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable local state
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        phone: '',
        address: ''
    });
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const response = await complianceApi.getProfile();
            if (response && response.success) {
                const data = response.data;
                setProfile(data);
                setFormData({
                    phone: data.phone || '',
                    address: data.address || ''
                });
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const payload = {
                phone: formData.phone,
                address: formData.address
            };
            const response = await complianceApi.updateProfile(payload);

            if (response && response.success) {
                setProfile(response.data);
                setEditMode(false);
                setSuccessMessage('Profile updated successfully!');
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/compliance/dashboard' },
        { id: 'audits', label: 'Global Audits', icon: 'policy', path: '/compliance/global-audits' },
        { id: 'incidents', label: 'Incidents', icon: 'gavel', path: '/compliance/incidents' },
        { id: 'overrides', label: 'Consent Overrides', icon: 'key_off', path: '/compliance/consent-overrides' }
    ];

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--background-light)] dark:bg-[var(--background-dark)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative">
                {/* Logo Area */}
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/compliance/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-slate-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-slate-800 dark:bg-slate-700 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(71,85,105,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">admin_panel_settings</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:drop-shadow-[0_0_10px_rgba(71,85,105,0.4)]">Medicare</h1>
                </div>

                {/* Navigation Links */}
                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Profile & Logout */}
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/compliance/profile" className="flex items-center gap-3 px-4 py-3 bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition rounded-xl font-medium"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-slate-400/5 dark:bg-slate-600/5 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                {/* Header (Sticky Header) */}
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300">My Profile</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your professional information and settings</p>
                    </div>
                </header>

                {/* Right Floating Theme Toggle */}
                <div className="absolute top-6 right-8 z-[60]">
                    <ThemeToggle />
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">
                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 shadow-sm animate-fade-in">
                            <span className="material-symbols-outlined">check_circle</span>
                            <span className="font-medium">{successMessage}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {/* Left Column: ID Card style summary */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-slate-500/20 to-gray-500/20 dark:from-slate-500/10 dark:to-gray-500/10"></div>

                                <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden relative z-10 mb-4 bg-slate-100 dark:bg-slate-800 group-hover:scale-105 transition-transform duration-500">
                                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-slate-300 dark:text-slate-600">
                                        {profile.firstName[0]}{profile.lastName[0]}
                                    </div>
                                </div>

                                <h1 className="text-2xl font-bold text-slate-800 dark:text-white relative z-10">{profile.firstName} {profile.lastName}</h1>
                                <p className="text-slate-600 dark:text-slate-400 font-medium relative z-10 mb-6">{profile.role}</p>

                                <div className="w-full flex justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 relative z-10">
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Status</span>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${profile.status === 'Active'
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${profile.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                            {profile.status}
                                        </span>
                                    </div>
                                    <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Employee ID</span>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">{profile.employeeId}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Professional Details summary */}
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Professional Info</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">
                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">domain</span>
                                            <span className="text-sm">Department</span>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.department}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">
                                        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                                            <span className="text-sm">Joined</span>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{new Date(profile.joinedDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Detailed Settings */}
                        <div className="xl:col-span-2 space-y-6">
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 shadow-sm">
                                <div className="flex justify-between items-center mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-500">contact_mail</span>
                                        Contact Information
                                    </h3>
                                    {!editMode ? (
                                        <button
                                            onClick={() => setEditMode(true)}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition"
                                        >
                                            Edit Details
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditMode(false);
                                                    setFormData({ phone: profile.phone, address: profile.address });
                                                }}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition"
                                                disabled={saving}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editMode ? (
                                    <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 px-1">Email Address</label>
                                                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed">
                                                    {profile.email}
                                                    <span className="text-xs text-slate-400 ml-2 font-normal italic">(Read Only)</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 px-1">Phone Number</label>
                                                <input
                                                    type="text"
                                                    name="phone"
                                                    value={formData.phone}
                                                    onChange={handleInputChange}
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 rounded-xl outline-none transition-all text-slate-800 dark:text-slate-200"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 px-1">Residential Address</label>
                                                <textarea
                                                    name="address"
                                                    value={formData.address}
                                                    onChange={handleInputChange}
                                                    rows="3"
                                                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-slate-500 dark:focus:border-slate-400 focus:ring-4 focus:ring-slate-500/10 rounded-xl outline-none transition-all text-slate-800 dark:text-slate-200 resize-none"
                                                    required
                                                ></textarea>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="px-6 py-3 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center min-w-[140px]"
                                            >
                                                {saving ? (
                                                    <span className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></span>
                                                ) : (
                                                    "Save Changes"
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
                                                    <span className="material-symbols-outlined text-[18px]">mail</span>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider">Email Address</h4>
                                                </div>
                                                <p className="font-medium text-slate-800 dark:text-slate-200 pl-6">{profile.email}</p>
                                            </div>

                                            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
                                                    <span className="material-symbols-outlined text-[18px]">phone</span>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider">Phone Number</h4>
                                                </div>
                                                <p className="font-medium text-slate-800 dark:text-slate-200 pl-6">{profile.phone}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
                                                <span className="material-symbols-outlined text-[18px]">home_pin</span>
                                                <h4 className="text-xs font-bold uppercase tracking-wider">Residential Address</h4>
                                            </div>
                                            <p className="font-medium text-slate-800 dark:text-slate-200 pl-6">{profile.address}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Profile;
