import { brandName } from '../../config/brand';
import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { staffApi } from '../../api/staffApi';
import ThemeToggle from '../../components/common/ThemeToggle';

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

                <div className="relative z-10 glass-card p-10 rounded-3xl shadow-sm border border-line dark:border-line flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 border-t-primary-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Validating your invitation…</p>
                </div>
            </div>
        );
    }

    if (validationError) {
        return (
            <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] min-h-screen flex items-center justify-center transition-colors duration-300 relative overflow-hidden">

                <ThemeToggle className="absolute top-4 right-4 z-50" />
                <div className="relative z-10 max-w-md w-full mx-4 glass-card p-8 sm:p-10 rounded-3xl shadow-sm border border-line dark:border-line text-center animate-fade-in">
                    <div className="w-16 h-16 mx-auto bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6 border-2 border-rose-200 dark:border-rose-800/50 text-rose-500">
                        <span className="material-symbols-outlined text-3xl">error</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invalid Invitation</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">{validationError}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all duration-300 transform"
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

                <div className="relative z-10 max-w-md w-full mx-4 glass-card p-10 rounded-3xl shadow-sm border border-line dark:border-line text-center animate-fade-in">
                    <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-lg shadow-primary-500/30 text-white bg-primary-600">
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


            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-xl glass-card rounded-3xl shadow-sm relative z-10 animate-fade-in p-8 sm:p-10 border border-line dark:border-line">

                {/* Logo & Header */}
                <Brand to={'/'} className="mc-brand--large mc-brand--stack" />

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Complete Registration</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Set up your account to access the healthcare portal.</p>
                </div>

                {/* Role Badge */}
                <div className="flex justify-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800/50 text-primary-700 dark:text-primary-300 text-sm font-semibold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-primary-500"></span>
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
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
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
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
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
                                className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
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
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
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
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                    placeholder="Re-enter password"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className={`mt-6 w-full flex justify-center py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 transform ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {submitting ? 'Creating Account...' : 'Create My Account'}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Already have an account?{' '}
                    <a href="/login" className="font-bold text-primary-600 dark:text-primary-400 hover:text-primary-500 hover:underline transition-colors">
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
                        <span className="material-symbols-outlined text-[16px] mr-1 text-primary-500">shield</span>
                        Secure Auth
                    </div>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="material-symbols-outlined text-[16px] mr-1 text-primary-500">group</span>
                        Role-Based Access
                    </div>
                </div>
            </div>

            <div className="absolute bottom-6 w-full text-center z-10">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default AcceptInvitation;
