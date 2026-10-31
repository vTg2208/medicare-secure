import { brandName } from '../config/brand';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Brand from '../components/common/Brand';
import ThemeToggle from '../components/common/ThemeToggle';
import { isDemoMode } from '../config/demoMode';
import '../pages/patient/Dashboard.css'; // Reusing glassmorphism styles

function LandingPage() {
    const navigate = useNavigate();
    const appName = brandName;

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
            <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex flex-wrap gap-4 items-center justify-between border-b border-line dark:border-slate-800/50">
                <div className="flex items-center gap-3"><Brand /><span className={`w-2 h-2 rounded-full ${isBackendUp ? 'bg-emerald-600' : 'bg-amber-600'}`} title={isBackendUp ? 'System online' : 'Connecting to service'} /></div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2.5 rounded-lg font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => navigate(isDemoMode ? '/login' : '/register')}
                        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold shadow-md transition-colors"
                    >
                        {isDemoMode ? 'Explore demo' : 'Sign Up'}
                    </button>
                    <ThemeToggle />
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-grow flex flex-col items-center justify-center p-8 relative overflow-hidden">
                {/* Decorative background blur elements */}



                <div className="max-w-4xl w-full text-center space-y-8 z-10 mt-12">
                    <div className="space-y-4 flex flex-col items-center">
                        <div className="flex flex-wrap justify-center gap-3 mb-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-primary-600 dark:text-primary-400 text-sm font-semibold border border-primary-200 dark:border-primary-900 shadow-sm transition-all hover:shadow-md">
                                <span className="material-symbols-outlined text-sm">security</span>
                                <span>Consent-Controlled Centralized Records</span>
                            </div>

                            {/* Live Stats Badge */}
                            {stats && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-primary-600 dark:text-primary-400 text-sm font-semibold border border-primary-200 dark:border-primary-900 shadow-sm transition-all hover:shadow-md animate-fade-in delay-150">
                                    <span className="material-symbols-outlined text-sm">monitoring</span>
                                    <span>{Number(stats.hospitalsCount || 0).toLocaleString()} registered healthcare facilities</span>
                                </div>
                            )}
                        </div>
                        <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                            Your health, connected. <br className="hidden md:block" />
                            <span className="text-accent">
                                Your care, in one place.
                            </span>
                        </h2>
                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            {appName} puts you in control. A patient-centric platform where only you manage your medical history, sharing it securely with licensed hospitals through robust consent controls.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 pb-4">
                        <button
                            onClick={() => navigate(isDemoMode ? '/login' : '/register')}
                            className="w-full sm:w-auto px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-lg shadow-sm shadow-primary-500/30 flex items-center justify-center gap-3 transition-transform"
                        >
                            <span>{isDemoMode ? 'Explore the Medicare demo' : 'Get Started as Patient'}</span>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full sm:w-auto px-8 py-4 glass-card text-slate-800 dark:text-white rounded-lg font-bold text-lg flex items-center justify-center gap-3 hover:bg-surface dark:hover:bg-slate-800/80 transition-all border border-slate-200 dark:border-slate-700"
                        >
                            <span>Log In</span>
                        </button>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 z-10">
                    <div className="glass-card p-8 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-6 transition-transform">
                            <span className="material-symbols-outlined text-3xl">verified_user</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">Consent-Driven</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Hospitals view your data only when you say so. Actively grant or revoke consent for your visits.
                        </p>
                    </div>

                    <div className="glass-card p-8 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-6 transition-transform">
                            <span className="material-symbols-outlined text-3xl">folder_managed</span>
                        </div>
                        <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">Centralized Records</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            No more tracking down files across clinics. All your medical history aggregated seamlessly in one place.
                        </p>
                    </div>

                    <div className="glass-card p-8 rounded-3xl hover:bg-surface dark:hover:bg-slate-800/80 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 transition-transform">
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
            <footer className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm border-t border-line dark:border-slate-800/50 mt-auto">
                <p>&copy; {new Date().getFullYear()} {appName}. Licensed to authorized healthcare providers only.</p>
            </footer>
        </div>
    );
}

export default LandingPage;
