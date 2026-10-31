import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ConsentForm from '../../components/consent/ConsentForm';
import ConsentCard from '../../components/consent/ConsentCard';
import { consentApi } from '../../api/consentApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';
import './Consent.css';

function Consent() {
    const { logout } = useContext(AuthContext);
    const [viewMode, setViewMode] = useState('active');
    const [showForm, setShowForm] = useState(false);
    const [editingConsent, setEditingConsent] = useState(null);
    const [consents, setConsents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (viewMode === 'active') loadConsents();
        else loadHistory();
    }, [viewMode]);

    const loadConsents = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await consentApi.getActiveConsents();
            setConsents(data || []);
        } catch (err) {
            if (err.response && err.response.status !== 404) setError('Failed to load active consents');
            else setConsents([]);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        setLoading(true);
        setError('');
        try {
            if (typeof consentApi.getConsentHistory !== 'function') throw new Error('History API not implemented yet');
            const data = await consentApi.getConsentHistory();
            setConsents(data || []);
        } catch (err) {
            setError('Failed to load consent history');
            setConsents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantSuccess = useCallback(() => {
        setShowForm(false);
        setEditingConsent(null);
        if (viewMode !== 'active') setViewMode('active');
        else loadConsents();
    }, [viewMode]);

    const handleEdit = useCallback((consent) => {
        setEditingConsent(consent);
        setShowForm(true);
    }, []);

    const handleRevoke = useCallback(async (consentId) => {
        try {
            await consentApi.revokeConsent(consentId);
            if (viewMode === 'active') loadConsents();
            else loadHistory();
        } catch (err) {
            alert('Failed to revoke consent: ' + (err.response?.data?.message || err.message));
        }
    }, [viewMode]);

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            {/* ── Theme Toggle ── */}
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            {/* ── Left Sidebar ── */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/patient/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                        Messages
                    </Link>
                    <Link to="/patient/medical-records" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/patient/consent" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/patient/audit-trail" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Audit Trail
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-grow p-8 overflow-y-auto h-full">
                <header className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Consent Management</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Control who can access your medical data and when.</p>
                </header>

                {/* Tab bar + action button */}
                {!showForm && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div className="flex bg-slate-100/80 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                            <button
                                onClick={() => setViewMode('active')}
                                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'active' ? "bg-primary-600 text-white shadow-md" : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                Active Consents
                            </button>
                            <button
                                onClick={() => setViewMode('history')}
                                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? "bg-primary-600 text-white shadow-md" : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                            >
                                Past Accesses
                            </button>
                        </div>
                        <button
                            onClick={() => { setEditingConsent(null); setShowForm(true); }}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-md shadow-primary-500/20 flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px] text-primary-200">add_circle</span>
                            Grant New Consent
                        </button>
                    </div>
                )}

                {/* Grant form */}
                {showForm && (
                    <ConsentForm
                        initialData={editingConsent}
                        onSuccess={handleGrantSuccess}
                        onCancel={() => { setShowForm(false); setEditingConsent(null); }}
                    />
                )}

                {/* Section label */}
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-1.5 h-5 bg-primary-500 rounded-full"></div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">
                        {viewMode === 'active' ? 'Active Consents' : 'Access History'}
                    </h3>
                </div>

                {/* States */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <span className="material-symbols-outlined text-5xl animate-spin mb-4">refresh</span>
                        <p className="text-sm font-medium">Loading consents...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 flex items-center gap-3 mb-4">
                        <span className="material-symbols-outlined">error</span>
                        {error}
                    </div>
                )}

                {!loading && consents.length === 0 && (
                    <div className="glass-card rounded-2xl border border-line dark:border-slate-700/50 p-16 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 rounded-2xl flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-3xl text-slate-400">verified_user</span>
                        </div>
                        {viewMode === 'active' ? (
                            <>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No Active Consents</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">You haven't granted any consents yet. Click "Grant New Consent" to choose a healthcare or research recipient and the data they may access.</p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No History Available</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">No past consent history found.</p>
                            </>
                        )}
                    </div>
                )}

                {!loading && consents.length > 0 && (
                    <div className="grid grid-cols-1 gap-4">
                        {consents.map((consent) => (
                            <ConsentCard
                                key={consent.id}
                                consent={consent}
                                onRevoke={handleRevoke}
                                onEdit={handleEdit}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default Consent;
