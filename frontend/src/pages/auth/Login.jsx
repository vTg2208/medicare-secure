import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { startAuthentication } from '@simplewebauthn/browser';
import ThemeToggle from '../../components/common/ThemeToggle';
import ParticleBackground from '../../components/common/ParticleBackground';
import '../patient/Dashboard.css';

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('password'); // 'password' or 'passkey'
    const successMessage = location.state?.message;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const navigateByRole = (role) => {
        const r = role?.toUpperCase();
        switch (r) {
            case 'PATIENT': navigate('/patient/dashboard'); break;
            case 'DOCTOR': navigate('/doctor/dashboard'); break;
            case 'ADMIN':
            case 'HOSPITAL_ADMIN':
            case 'SYSTEM_ADMIN': navigate('/admin/dashboard'); break;
            case 'NURSE': navigate('/nurse/dashboard'); break;
            case 'LAB_TECHNICIAN': navigate('/dashboard/lab'); break;
            case 'RADIOLOGIST': navigate('/radiology/dashboard'); break;
            case 'PHARMACIST': navigate('/pharmacist/dashboard'); break;
            case 'COMPLIANCE_OFFICER':
            case 'COMPLIANCE': navigate('/compliance/dashboard'); break;
            case 'INSURANCE':
            case 'INSURANCE_PROVIDER': navigate('/insurance/dashboard'); break;
            case 'RESEARCHER': navigate('/researcher/dashboard'); break;
            default: navigate('/staff/dashboard');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login(formData.email, formData.password);

            const payload = response.data || response;
            const user = payload.user || payload.data?.user;
            const accessToken = payload.accessToken || payload.token || payload.data?.accessToken;

            if (!user || !accessToken) {
                throw new Error('Invalid server response: Missing user/token');
            }

            login(user, accessToken);
            navigateByRole(user.role || user.roleName);
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.message?.includes('not verified')) {
                setError('Your account is not verified yet. Please check your email/phone for the OTP or contact support.');
                // Optionally redirect to a verification page if one exists,
                // but since Register.jsx handles it for now, we just inform them.
            } else {
                const errorMsg = err.response?.data?.message || err.message || 'Login failed';
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        if (!formData.email) {
            setError('Please enter your email or phone first');
            return;
        }

        setError('');
        setPasskeyLoading(true);

        try {
            // Step 1: Get authentication options from server
            const optionsRes = await authApi.passkeyLoginOptions(formData.email);
            if (!optionsRes.success) {
                throw new Error(optionsRes.message || 'Failed to get passkey options');
            }

            // Step 2: Trigger browser's WebAuthn prompt (fingerprint, face, PIN, etc.)
            const credential = await startAuthentication({ optionsJSON: optionsRes.data });

            // Step 3: Verify with server
            const verifyRes = await authApi.passkeyLoginVerify(formData.email, credential);

            const payload = verifyRes.data || verifyRes;
            const user = payload.user || payload.data?.user;
            const accessToken = payload.accessToken || payload.token || payload.data?.accessToken;

            if (!user || !accessToken) {
                throw new Error('Invalid server response');
            }

            login(user, accessToken);
            navigateByRole(user.role || user.roleName);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Passkey authentication was cancelled');
            } else {
                const errorMsg = err.response?.data?.message || err.message || 'Passkey login failed';
                setError(errorMsg);
            }
        } finally {
            setPasskeyLoading(false);
        }
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 transition-colors duration-300 relative overflow-hidden">
            {/* Dynamic Background Elements */}
            <ParticleBackground />

            {/* Theme Toggle styling */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-lg glass-card rounded-3xl shadow-2xl relative z-10 animate-fade-in p-8 sm:p-10 border border-white/40 dark:border-white/10">
                {/* Logo and App Name (Interactive Hover) */}
                <div className="flex flex-col items-center justify-center mb-8 group cursor-default">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-3xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                        {process.env.REACT_APP_APP_NAME || 'MediCare'}
                    </h1>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sign in to access your dashboard</p>
                </div>

                {successMessage && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 flex items-center shadow-sm text-sm">
                        <span className="material-symbols-outlined text-[20px] mr-2">check_circle</span>
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 flex items-center shadow-sm text-sm">
                        <span className="material-symbols-outlined text-[20px] mr-2">error</span>
                        {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex p-1 mb-6 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-white/20 dark:border-slate-700/50">
                    <button
                        type="button"
                        onClick={() => { setActiveTab('password'); setError(''); }}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'password' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        Password
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveTab('passkey'); setError(''); }}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'passkey' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                        Passkey
                    </button>
                </div>

                <div className="relative overflow-hidden w-full transition-all duration-500" style={{ minHeight: '260px' }}>
                    {/* Password Tab Content */}
                    <div className={`absolute top-0 left-0 w-full transition-all duration-500 transform ${activeTab === 'password' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`}>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Email or Phone</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                        <span className="material-symbols-outlined text-[20px]">alternate_email</span>
                                    </div>
                                    <input
                                        type="text"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required={activeTab === 'password'}
                                        className="block w-full pl-12 pr-4 py-3.5 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                        placeholder="email@example.com or +91..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                        <span className="material-symbols-outlined text-[20px]">lock</span>
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required={activeTab === 'password'}
                                        className="block w-full pl-12 pr-4 py-3.5 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`mt-6 w-full flex justify-center py-4 px-4 rounded-2xl shadow-xl shadow-indigo-500/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-[1.02] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Signing In...' : 'Sign In'}
                            </button>
                        </form>
                    </div>

                    {/* Passkey Tab Content */}
                    <div className={`absolute top-0 left-0 w-full transition-all duration-500 transform ${activeTab === 'passkey' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}`}>
                        <div className="space-y-6">
                            <div className="text-center mb-2">
                                <span className="material-symbols-outlined text-5xl text-indigo-500/50 mb-2">passkey</span>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Sign in securely without a password using your device's biometric authentication.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                        <span className="material-symbols-outlined text-[20px]">mail</span>
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required={activeTab === 'passkey'}
                                        className="block w-full pl-12 pr-4 py-3.5 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handlePasskeyLogin}
                                disabled={passkeyLoading || !formData.email}
                                className={`w-full inline-flex justify-center items-center px-4 py-4 shadow-xl shadow-indigo-500/20 text-sm font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-[1.02] ${passkeyLoading || !formData.email ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                <span className="material-symbols-outlined text-[20px] mr-2">fingerprint</span>
                                {passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey'}
                            </button>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Don't have an account?{' '}
                    <a href="/register" className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline transition-colors">
                        Sign Up as Patient
                    </a>
                </p>
            </div>

            <div className="absolute bottom-6 w-full text-center z-10">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    &copy; {new Date().getFullYear()} {process.env.REACT_APP_APP_NAME || 'MediCare'}. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default Login;
