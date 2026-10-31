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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-['Inter'] w-full">
            {/* Sidebar */}
            <aside className="w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 p-8 flex flex-col h-full z-20">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/pharmacist/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]">Medicare</h1>
                </div>

                <nav className="flex-grow space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? 'bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 shadow-sm'
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
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
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
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/5 dark:bg-teal-400/5 rounded-full blur-3xl -z-10 transform -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

                <header className="mb-10 flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300">My Profile</h2>
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
                        <div className="md:col-span-1 bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm flex flex-col items-center text-center">
                            <div className="w-28 h-28 rounded-3xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-4xl font-bold mb-6 border border-emerald-100 dark:border-emerald-800/30 shadow-inner overflow-hidden">
                                {profile.profilePhoto ? (
                                    <img src={profile.profilePhoto} alt={`${profile.firstName} ${profile.lastName}`} className="w-full h-full object-cover" />
                                ) : (
                                    <span>{profile.firstName?.charAt(0) || 'P'}{profile.lastName?.charAt(0) || 'D'}</span>
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{profile.firstName || 'Pharmacist'} {profile.lastName || 'Staff'}</h2>
                            <p className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest text-xs mb-6 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">{profile.role || 'Pharmacist'}</p>

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
                            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                                <div className="flex items-center justify-between mb-8 relative z-10">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-500 flex items-center justify-center">
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
                                        className="px-4 py-2 rounded-xl text-sm font-semibold transition bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                                    >
                                        {editMode ? 'Cancel' : 'Edit Details'}
                                    </button>
                                </div>

                                {editMode ? (
                                    <form onSubmit={handleSave} className="space-y-5 relative z-10">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Phone Number</label>
                                                <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} required className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm font-medium" />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Home Address</label>
                                                <textarea name="address" value={formData.address} onChange={handleInputChange} required rows={2} className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition text-sm font-medium resize-none" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <button type="submit" disabled={saving} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
                                                {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div> : <span className="material-symbols-outlined text-[18px]">save</span>}
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
                                <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center">
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
                                <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-amber-500/30 transition-colors">
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
                            <div className="bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl p-8 border border-slate-200/50 dark:border-slate-800/50 shadow-sm relative overflow-hidden group hover:border-rose-500/30 transition-colors">
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
