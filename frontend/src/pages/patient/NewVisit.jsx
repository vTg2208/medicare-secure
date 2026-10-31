import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Scanner } from '@yudiel/react-qr-scanner';

const NewVisit = () => {
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [manualUrl, setManualUrl] = useState('');

    const handleScan = (result) => {
        if (result && result.length > 0) {
            try {
                // Determine format
                const rawValue = result[0].rawValue || result[0];
                let params = '';

                if (rawValue.startsWith('{')) {
                    const parsed = JSON.parse(rawValue);
                    params = new URLSearchParams(parsed).toString();
                } else if (rawValue.includes('?')) {
                    params = rawValue.split('?')[1];
                } else {
                    params = rawValue;
                }

                navigate('/patient/consent/grant?' + params);
            } catch (err) {
                setError('Invalid QR Code format.');
            }
        }
    };

    const handleManualUrl = () => {
        setError(null);
        try {
            const url = manualUrl.trim();
            let params = '';
            if (url.includes('?')) {
                params = url.split('?')[1];
            } else if (url.startsWith('{')) {
                params = new URLSearchParams(JSON.parse(url)).toString();
            } else {
                params = url;
            }
            navigate('/patient/consent/grant?' + params);
        } catch (err) {
            setError('Invalid URL format. Please enter a valid consent URL.');
        }
    };

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark');
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 p-4 lg:p-8">
            <div className="max-w-[1440px] mx-auto glass-panel rounded-3xl min-h-[90vh] shadow-2xl flex overflow-hidden">
                {/* Left Sidebar */}
                <aside className="w-64 border-r border-white/20 dark:border-slate-800/50 p-6 flex flex-col hidden md:flex">
                    <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => navigate('/patient/dashboard')}>
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-sm">local_hospital</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">Medicare</h1>
                    </div>
                    <nav className="space-y-2 flex-grow">
                        <button onClick={() => navigate('/patient/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                            Dashboard
                        </button>
                        <button onClick={() => navigate('/patient/visits')} className="w-full flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                            Appointments
                        </button>
                        <button onClick={() => navigate('/patient/messages')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                            Messages
                        </button>
                        <button onClick={() => navigate('/patient/medical-records')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                            Records
                        </button>
                        <button onClick={() => navigate('/patient/consent')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">verified_user</span>
                            Consents
                        </button>
                    </nav>
                    <div className="space-y-2 mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
                        <button onClick={() => navigate('/patient/support')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                            <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                            Support
                        </button>
                        <button onClick={toggleDarkMode} className="p-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500 !block dark:!hidden">dark_mode</span>
                            <span className="material-symbols-outlined text-amber-500 !hidden dark:!block">light_mode</span>
                            <span className="!block dark:!hidden">Dark Mode</span>
                            <span className="!hidden dark:!block">Light Mode</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-grow p-4 md:p-8 flex items-center justify-center relative overflow-y-auto">
                    <button
                        onClick={() => navigate('/patient/visits')}
                        className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        Back to Visits
                    </button>

                    <div className="w-full max-w-lg glass-card rounded-3xl p-8 border border-white/50 dark:border-slate-700/50 shadow-xl relative overflow-hidden group">
                        <div className="absolute -top-20 -right-20 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex flex-col items-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 shadow-inner">
                                    <span className="material-symbols-outlined text-3xl">add_circle</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">Request a New Visit</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm text-center">Fill out the details below to schedule an appointment with your preferred doctor.</p>
                            </div>

                            {error && (
                                <div className="bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                                    <span className="material-symbols-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="w-full max-w-sm aspect-square bg-black rounded-xl overflow-hidden shadow-inner relative">
                                    <Scanner
                                        onScan={handleScan}
                                        onError={(err) => setError('Camera error: ' + err.message)}
                                        components={{ finder: false }}
                                    />
                                    {/* Overlay guide */}
                                    <div className="absolute inset-0 border-[3px] border-dashed border-white/50 m-8 rounded-lg pointer-events-none"></div>
                                </div>
                                <p className="text-xs text-slate-500 mt-4 text-center font-medium">Position the QR code within the frame to scan.</p>
                            </div>

                            {/* Manual URL entry fallback */}
                            <div className="mt-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">or enter URL manually</span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={manualUrl}
                                        onChange={(e) => setManualUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualUrl()}
                                        placeholder="Paste the consent URL here..."
                                        className="flex-1 px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm text-slate-900 dark:text-white"
                                    />
                                    <button
                                        onClick={handleManualUrl}
                                        disabled={!manualUrl.trim()}
                                        className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default NewVisit;
