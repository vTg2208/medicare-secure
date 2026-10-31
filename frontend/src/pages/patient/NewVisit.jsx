import ThemeToggle from '../../components/common/ThemeToggle';
import Brand from '../../components/common/Brand';
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

return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 p-4 lg:p-8">
            <div className="max-w-[1440px] mx-auto glass-panel rounded-3xl min-h-[90vh] shadow-sm flex overflow-hidden mc-workspace mc-visit-flow">
                {/* Left Sidebar */}
                <aside className="w-64 border-r border-line dark:border-slate-800/50 p-6 flex flex-col mc-sidebar">
                    <Brand to={'/patient/dashboard'} />
                    <nav className="space-y-2 flex-grow">
                        <button onClick={() => navigate('/patient/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                            Dashboard
                        </button>
                        <button onClick={() => navigate('/patient/visits')} className="w-full flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-lg font-medium text-slate-800 dark:text-slate-800">
                            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                            Appointments
                        </button>
                        <button onClick={() => navigate('/patient/messages')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                            Messages
                        </button>
                        <button onClick={() => navigate('/patient/medical-records')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                            Records
                        </button>
                        <button onClick={() => navigate('/patient/consent')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">verified_user</span>
                            Consents
                        </button>
                    </nav>
                    <div className="space-y-2 mt-auto pt-6 border-t border-line dark:border-slate-800/50">
                        <button onClick={() => navigate('/patient/support')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                            <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                            Support
                        </button>
                        <ThemeToggle />
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

                    <div className="w-full max-w-lg glass-card rounded-3xl p-8 border border-line dark:border-slate-700/50 shadow-sm relative overflow-hidden group">



                        <div className="relative z-10">
                            <div className="flex flex-col items-center mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4 shadow-inner">
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
                                    <div className="absolute inset-0 border-[3px] border-dashed border-line m-8 rounded-lg pointer-events-none"></div>
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
                                        className="flex-1 px-4 py-3 bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm text-slate-900 dark:text-white"
                                    />
                                    <button
                                        onClick={handleManualUrl}
                                        disabled={!manualUrl.trim()}
                                        className="px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
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
