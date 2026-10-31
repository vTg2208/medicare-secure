import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { staffApi } from '../../api/staffApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import ParticleBackground from '../../components/common/ParticleBackground';
import '../patient/Dashboard.css'; // Importing dashboard css for common utility classes if any, though we aim for pure tailwind

function AcceptInvitation() {
    const navigate = useNavigate();
    const { token } = useParams();

    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [validationError, setValidationError] = useState('');
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        password: '',
        confirmPassword: '',
        phone: '',
    });

    useEffect(() => {
        const validateToken = async () => {
            try {
                const response = await staffApi.validateInvitation(token);
                if (response.success && response.data) {
                    setInvitation(response.data);
                } else {
                    setValidationError('Invalid or expired invitation');
                }
            } catch (err) {
                setValidationError(err.response?.data?.message || 'Invalid or expired invitation link');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            validateToken();
        } else {
            setValidationError('Missing invitation token');
            setLoading(false);
        }
    }, [token]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setSubmitting(true);
        try {
            const response = await staffApi.acceptInvitation(token, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                password: formData.password,
                phone: formData.phone,
            });

            if (response.success) {
                setSuccess(true);
                setTimeout(() => navigate('/login', {
                    state: { message: 'Account created successfully! Please login.' }
                }), 2500);
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to create account. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] min-h-screen flex items-center justify-center transition-colors duration-300 relative overflow-hidden">
                <ParticleBackground />
                <div className="relative z-10 glass-card p-10 rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Validating your invitation…</p>
                </div>
            </div>
        );
    }

    if (validationError) {
        return (
            <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] min-h-screen flex items-center justify-center transition-colors duration-300 relative overflow-hidden">
                <ParticleBackground />
                <ThemeToggle className="absolute top-4 right-4 z-50" />
                <div className="relative z-10 max-w-md w-full mx-4 glass-card p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 text-center animate-fade-in">
                    <div className="w-16 h-16 mx-auto bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6 border-2 border-rose-200 dark:border-rose-800/50 text-rose-500">
                        <span className="material-symbols-outlined text-3xl">error</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invalid Invitation</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">{validationError}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-4 px-4 rounded-2xl shadow-xl shadow-indigo-500/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all duration-300 transform hover:scale-[1.02]"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] min-h-screen flex items-center justify-center transition-colors duration-300 relative overflow-hidden">
                <ParticleBackground />
                <div className="relative z-10 max-w-md w-full mx-4 glass-card p-10 rounded-3xl shadow-2xl border border-white/40 dark:border-white/10 text-center animate-fade-in">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30 text-white animate-bounce">
                        <span className="material-symbols-outlined text-4xl">check</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Account Created!</h2>
                    <p className="text-slate-500 dark:text-slate-400">Redirecting you to the login page…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 transition-colors duration-300 relative overflow-hidden">
            <ParticleBackground />

            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-xl glass-card rounded-3xl shadow-2xl relative z-10 animate-fade-in p-8 sm:p-10 border border-white/40 dark:border-white/10">

                {/* Logo & Header */}
                <div className="flex flex-col items-center justify-center mb-6 group cursor-default">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-3xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {process.env.REACT_APP_APP_NAME || 'MediCare'}
                    </h1>
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Complete Registration</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Set up your account to access the healthcare portal.</p>
                </div>

                {/* Role Badge */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-sm font-semibold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        Invited as <span className="uppercase tracking-wider">{invitation?.role}</span>
                    </div>
                </div>

                {/* Email Info Box */}
                <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner">
                    <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                        <span className="material-symbols-outlined mr-2 text-[20px]">mark_email_read</span>
                        Invitation sent to
                    </div>
                    <div className="text-slate-900 dark:text-white font-semibold text-sm">
                        {invitation?.email}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 flex items-center shadow-sm text-sm">
                        <span className="material-symbols-outlined text-[20px] mr-2 flex-shrink-0">error</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* First Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">First Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                    <span className="material-symbols-outlined text-[20px]">person</span>
                                </div>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    required
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                    placeholder="First Name"
                                />
                            </div>
                        </div>

                        {/* Last Name */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Last Name</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                    <span className="material-symbols-outlined text-[20px]">person</span>
                                </div>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    required
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                    placeholder="Last Name"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Phone Number</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                <span className="material-symbols-outlined text-[20px]">phone</span>
                            </div>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                                className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                placeholder="+91 98765 43210"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Password */}
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
                                    required
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                    placeholder="Min. 8 chars"
                                />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Confirm Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                    <span className="material-symbols-outlined text-[20px]">lock</span>
                                </div>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-all duration-200 text-sm shadow-inner backdrop-blur-sm"
                                    placeholder="Re-enter password"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className={`mt-6 w-full flex justify-center py-4 px-4 rounded-2xl shadow-xl shadow-indigo-500/20 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-[1.02] ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {submitting ? 'Creating Account...' : 'Create My Account'}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <a href="/login" className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 hover:underline transition-colors">
                        Sign in here
                    </a>
                </p>

                {/* Features strip matching Login */}
                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-6 sm:gap-8 flex-wrap">
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="material-symbols-outlined text-[16px] mr-1 text-emerald-500">lock</span>
                        Aggregated research data
                    </div>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="material-symbols-outlined text-[16px] mr-1 text-blue-500">shield</span>
                        Secure Auth
                    </div>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="material-symbols-outlined text-[16px] mr-1 text-indigo-500">group</span>
                        Role-Based Access
                    </div>
                </div>
            </div>

            <div className="absolute bottom-6 w-full text-center z-10">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    &copy; {new Date().getFullYear()} {process.env.REACT_APP_APP_NAME || 'MediCare'}. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default AcceptInvitation;
