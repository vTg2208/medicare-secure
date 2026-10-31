import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { pharmacistApi } from '../../api/pharmacistApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const PharmacistProfile = () => {
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
            const response = await pharmacistApi.getProfile();
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
                phone: formData.phone
            };
            const response = await pharmacistApi.updateProfile(payload);

            if (response && response.success) {
                setProfile({ ...response.data, address: formData.address });
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
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/pharmacist/dashboard' },
        { id: 'prescriptions', label: 'Prescriptions', icon: 'prescriptions', path: '/pharmacist/prescriptions' },
        { id: 'inventory', label: 'Inventory', icon: 'inventory_2', path: '/pharmacist/inventory' },
        { id: 'audit', label: 'Audit Logs', icon: 'history_edu', path: '/pharmacist/audit-logs' }
    ];

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans w-full mc-workspace">
            {/* Sidebar */}
            <aside className="w-72 bg-surface dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 p-8 flex flex-col h-full z-20 mc-sidebar">
                <Brand to={'/pharmacist/dashboard'} />

                <nav className="flex-grow space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? "bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm"
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <Link to="/pharmacist/profile" className="flex items-center gap-3 px-4 py-3 bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 shadow-sm rounded-xl font-medium">
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
                {/* Decorative Elements */}



                <header className="mb-10 flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-bold text-accent">My Profile</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your professional details and contact information.</p>
                    </div>
                </header>

                <div className="max-w-6xl space-y-6">
                    {successMessage && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3 animate-fade-in-up">
                            <span className="material-symbols-outlined">check_circle</span>
                            <span className="font-medium">{successMessage}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Identity Card */}
                        <div className="md:col-span-1 bg-surface dark:bg-slate-900/40 rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm flex flex-col items-center text-center">
                            <div className="w-28 h-28 rounded-3xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-4xl font-bold mb-6 border border-primary-100 dark:border-primary-800/30 shadow-inner overflow-hidden">
                                {profile.profilePhoto ? (
                                    <img src={profile.profilePhoto} alt={`${profile.firstName} ${profile.lastName}`} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{profile.firstName?.charAt(0) || 'P'}{profile.lastName?.charAt(0) || 'D'}</span>
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{profile.firstName || 'Pharmacist'} {profile.lastName || 'Staff'}</h2>
                            <p className="text-primary-600 dark:text-primary-400 font-bold uppercase tracking-widest text-xs mb-6 px-3 py-1 bg-primary-50 dark:bg-primary-900/30 rounded-lg">{profile.role || 'Pharmacist'}</p>

                            <div className="w-full pt-6 border-t border-slate-200/50 dark:border-slate-800/50 space-y-4 text-left">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Employee ID</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">badge</span>
                                        {profile.employeeId || 'EMP-PHARM'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Status</p>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${(!profile.status || profile.status === 'active' || profile.status === 'Active') ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'} text-xs font-bold`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${(!profile.status || profile.status === 'active' || profile.status === 'Active') ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                        {profile.status || 'Active'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Department</p>
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">domain</span>
                                        {profile.department || 'Pharmacy'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Middle & Right Column: Details */}
                        <div className="md:col-span-2 space-y-6">

                            {/* Contact Details */}
                            <div className="bg-surface dark:bg-slate-900/40 rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-primary-500/30 transition-colors">
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-500 flex items-center justify-center">
                                            <span className="material-symbols-outlined">contact_mail</span>
                                        </div>
                                        Contact Information
                                    </h3>
                                    <button
                                        onClick={() => {
                                            if (editMode) {
                                                setFormData({ phone: profile.phone || '', address: profile.address || '' });
                                            }
                                            setEditMode(!editMode);
                                        }}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold transition bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                                    >
                                        {editMode ? 'Cancel' : 'Edit Details'}
                                    </button>
                                </div>

                                {editMode ? (
                                    <form onSubmit={handleSave} className="space-y-5 relative z-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Phone Number</label>
                                                <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} required className="w-full bg-surface dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition text-sm font-medium" />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Home Address</label>
                                                <textarea name="address" value={formData.address} onChange={handleInputChange} required rows={2} className="w-full bg-surface dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition text-sm font-medium resize-none" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <button type="submit" disabled={saving} className="px-6 py-3 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 bg-primary-600">
                                                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-line border-t-white"></div> : <span className="material-symbols-outlined text-[18px]">save</span>}
                                                Save Changes
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Email Address</p>
                                            <p className="text-slate-800 dark:text-slate-200 font-semibold">{profile.email}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Phone Number</p>
                                            <p className="text-slate-800 dark:text-slate-200 font-semibold">{profile.phone}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Home Address</p>
                                            <p className="text-slate-800 dark:text-slate-200 font-semibold whitespace-pre-wrap">{profile.address}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dual Row: Professional & Assignments */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Professional Credentials */}
                                <div className="bg-surface dark:bg-slate-900/40 rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-primary-500/30 transition-colors">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-500 flex items-center justify-center">
                                            <span className="material-symbols-outlined">verified</span>
                                        </div>
                                        Credentials
                                    </h3>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">License Number</p>
                                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{profile.licenseNumber || 'PENDING'}</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Joined Date</p>
                                            <p className="text-slate-800 dark:text-slate-200 font-semibold">
                                                {profile.joinedDate ? new Date(profile.joinedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Assignments */}
                                <div className="bg-surface dark:bg-slate-900/40 rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-amber-500/30 transition-colors">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <span className="material-symbols-outlined text-9xl">inventory_2</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3 relative z-10">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center">
                                            <span className="material-symbols-outlined">assignment</span>
                                        </div>
                                        Assignments
                                    </h3>
                                    <div className="space-y-6 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">Assigned Sectors</p>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.assignedWards?.map((ward, idx) => (
                                                    <span key={idx} className="px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-100 dark:border-amber-800/50">
                                                        {ward}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Shift Preference</p>
                                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                                                <span className="material-symbols-outlined text-amber-500 text-[18px]">light_mode</span>
                                                {profile.shiftPreference || 'Day Shift'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Emergency Contact */}
                            <div className="bg-surface dark:bg-slate-900/40 rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-rose-500/30 transition-colors">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center">
                                        <span className="material-symbols-outlined">contact_emergency</span>
                                    </div>
                                    Emergency Contact
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Name</p>
                                        <p className="text-slate-800 dark:text-slate-200 font-semibold">{profile.emergencyContact?.name || 'Not Provided'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Relationship</p>
                                        <p className="text-slate-800 dark:text-slate-200 font-semibold">{profile.emergencyContact?.relationship || 'Not Provided'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Phone Number</p>
                                        <p className="text-slate-800 dark:text-slate-200 font-semibold">{profile.emergencyContact?.phone || 'Not Provided'}</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PharmacistProfile;
