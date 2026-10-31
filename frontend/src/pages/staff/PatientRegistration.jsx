import Brand from '../../components/common/Brand';
import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';

function PatientRegistration() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '', // Auto-generated or manual, keeping it manual for simplicity
        dateOfBirth: '',
        gender: '',
        bloodGroup: '',
        govtId: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        insuranceProvider: '',
        insurancePolicyNumber: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let pass = '';
        for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        setFormData(prev => ({ ...prev, password: pass }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMessage('');

        if (!formData.password) {
            setError("Password is required. Click 'Generate' to create a secure default password.");
            setLoading(false);
            return;
        }

        try {
            await authApi.registerPatient(formData);

            setSuccessMessage(`Patient ${formData.firstName} registered successfully!`);

            // Optionally clear form
            setFormData({
                firstName: '', lastName: '', email: '', phone: '', password: '',
                dateOfBirth: '', gender: '', bloodGroup: '', govtId: '',
                address: '', city: '', state: '', country: '', postalCode: '',
                emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
                insuranceProvider: '', insurancePolicyNumber: ''
            });

            // Automatically hide success message after 5 seconds
            setTimeout(() => setSuccessMessage(''), 5000);

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to register patient. Please verify all details.');
        } finally {
            setLoading(false);
        }
    };

    const navToVisits = () => {
        if (user?.role === 'receptionist' || user?.roleName === 'receptionist') {
            navigate('/receptionist/visits');
        } else {
            navigate('/staff/visit-queue');
        }
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto w-full md:w-64 z-20 mc-sidebar">
                <Brand to={'/staff/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/staff/dashboard" className="w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Overview
                    </Link>
                    <button onClick={navToVisits} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                        <span className="material-symbols-outlined text-[20px]">fact_check</span>
                        Visit Management
                    </button>
                    <Link to="/staff/registration" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800 shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">person_add</span>
                        Patient Registration
                    </Link>
                    <Link to="/staff/workflow" className="w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                        Clinical Workflow
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <button onClick={logout} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Patient Registration</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Create new patient profiles and record demographics
                            </p>
                        </div>
                    </div>
                </header>

                <div className="glass-card rounded-3xl p-8 max-w-4xl mx-auto shadow-sm">
                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center gap-3">
                            <span className="material-symbols-outlined">check_circle</span>
                            <span className="font-medium">{successMessage}</span>
                        </div>
                    )}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl flex items-center gap-3">
                            <span className="material-symbols-outlined">error</span>
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* Section: Basic Details */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                                    <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                                    <input required type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                                    <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                                    <input required type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Date of Birth *</label>
                                    <input required type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Initial Password *</label>
                                        <button type="button" onClick={generatePassword} className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline">Generate</button>
                                    </div>
                                    <input required type="text" name="password" value={formData.password} onChange={handleChange} placeholder="Secure password" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Section: Demographics */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Demographics & Identity</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                                    <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white">
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
                                    <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white">
                                        <option value="">Select</option>
                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Government ID (Optional)</label>
                                    <input type="text" name="govtId" value={formData.govtId} onChange={handleChange} placeholder="e.g. SSN / Aadhar" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Address</label>
                                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">City</label>
                                    <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">State / Region</label>
                                    <input type="text" name="state" value={formData.state} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Country</label>
                                    <input type="text" name="country" value={formData.country} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Postal Code</label>
                                    <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact & Insurance */}
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">Contacts & Insurance</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Contact Name</label>
                                    <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Emergency Phone</label>
                                    <input type="text" name="emergencyContactPhone" value={formData.emergencyContactPhone} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Relation</label>
                                    <input type="text" name="emergencyContactRelation" value={formData.emergencyContactRelation} onChange={handleChange} placeholder="e.g. Spouse, Parent" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 bg-primary-50/50 dark:bg-primary-900/10 p-5 rounded-2xl border border-primary-100 dark:border-primary-800/30">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-primary-500">health_and_safety</span>
                                        Insurance Provider
                                    </label>
                                    <input type="text" name="insuranceProvider" value={formData.insuranceProvider} onChange={handleChange} placeholder="e.g. Medicare, Aetna" className="w-full px-4 py-2.5 bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-primary-500">numbers</span>
                                        Policy / Member ID
                                    </label>
                                    <input type="text" name="insurancePolicyNumber" value={formData.insurancePolicyNumber} onChange={handleChange} placeholder="e.g. POL-123456789" className="w-full px-4 py-2.5 bg-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
                            <button type="button" onClick={() => navigate('/staff/dashboard')} className="px-6 py-3 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading} className="px-6 py-3 rounded-lg font-bold bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center gap-2 disabled:opacity-70">
                                {loading && <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>}
                                {loading ? 'Registering...' : 'Register Patient'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default PatientRegistration;
