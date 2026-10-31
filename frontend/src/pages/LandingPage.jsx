import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import '../pages/patient/Dashboard.css'; // Reusing glassmorphism styles

function LandingPage() {
    const navigate = useNavigate();
    const appName = process.env.REACT_APP_APP_NAME || 'MediCare';

    const [stats, setStats] = useState(null);
    const [isBackendUp, setIsBackendUp] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await apiClient.get('/public/stats', { skipAuth: true });
                setIsBackendUp(true);
                if (response.data.success && response.data.data) setStats(response.data.data);
            } catch (err) {
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 min-h-screen flex flex-col">
            {/* Header / Navbar */}
            <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/20 dark:border-slate-800/50">
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg relative transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <img src="/medicare-icon.svg" alt="" className="w-10 h-10 rounded-xl" width="40" height="40" />
                            {/* Server Status Indicator */}
                            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-[var(--background-light)] dark:border-[var(--background-dark)] rounded-full ${isBackendUp ? 'bg-emerald-500' : 'bg-rose-500'}`} title={isBackendUp ? 'System Online' : 'System Offline'}></span>
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">
                        {appName}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => navigate('/register')}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md transition-colors"
                    >
                        Sign Up
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-grow flex flex-col items-center justify-center p-8 relative overflow-hidden">
                {/* Decorative background blur elements */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>

                <div className="max-w-4xl w-full text-center space-y-8 z-10 mt-12">
                    <div className="space-y-4 flex flex-col items-center">
                        <div className="flex flex-wrap justify-center gap-3 mb-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-indigo-600 dark:text-indigo-400 text-sm font-semibold border border-indigo-200 dark:border-indigo-900 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
                                <span className="material-symbols-outlined text-sm">security</span>
                                <span>Consent-Controlled Centralized Records</span>
                            </div>

                            {/* Live Stats Badge */}
                            {stats && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-teal-600 dark:text-teal-400 text-sm font-semibold border border-teal-200 dark:border-teal-900 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 animate-fade-in delay-150">
                                    <span className="material-symbols-outlined text-sm">monitoring</span>
                                    <span>{Number(stats.hospitalsCount || 0).toLocaleString()} registered healthcare facilities</span>
                                </div>
                            )}
                        </div>
                        <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                            Your Health Data, <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-teal-400">
                                Completely Secure.
                            </span>
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            {appName} puts you in control. A patient-centric platform where only you manage your medical history, sharing it securely with licensed hospitals through robust consent controls.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 pb-4">
                        <button
                            onClick={() => navigate('/register')}
                            className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-3 transition-transform hover:scale-105"
                        >
                            <span>Get Started as Patient</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full sm:w-auto px-8 py-4 glass-card text-slate-800 dark:text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all border border-slate-200 dark:border-slate-700"
                        >
                            <span>Log In</span>
                        </button>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 z-10">
                    <div className="glass-card p-8 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl">verified_user</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">Consent-Driven</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Hospitals view your data only when you say so. Actively grant or revoke consent for your visits.
                        </p>
                    </div>

                    <div className="glass-card p-8 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-6 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl">folder_managed</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">Centralized Records</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            No more tracking down files across clinics. All your medical history aggregated seamlessly in one place.
                        </p>
                    </div>

                    <div className="glass-card p-8 rounded-3xl hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl">local_police</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">Enterprise Security</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Access controls, consent checks, and audit trails help protect your healthcare records.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm border-t border-white/20 dark:border-slate-800/50 mt-auto">
                <p>&copy; {new Date().getFullYear()} {appName}. Licensed to authorized healthcare providers only.</p>
            </footer>
        </div>
    );
}

export default LandingPage;
