import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complianceApi } from '../../api/complianceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const ConsentOverrides = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [overrides, setOverrides] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOverrides();
    }, []);

    const fetchOverrides = async () => {
        try {
            setLoading(true);
            const response = await complianceApi.getConsentOverrides();
            if (response && response.success) {
                setOverrides(response.data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/compliance/dashboard' },
        { id: 'audits', label: 'Global Audits', icon: 'policy', path: '/compliance/global-audits' },
        { id: 'incidents', label: 'Incidents', icon: 'gavel', path: '/compliance/incidents' },
        { id: 'overrides', label: 'Consent Overrides', icon: 'key_off', path: '/compliance/consent-overrides' }
    ];

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                {/* Logo Area */}
                <Brand to={'/compliance/dashboard'} />

                {/* Navigation Links */}
                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Profile & Logout */}
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/compliance/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition rounded-lg font-medium"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}


                {/* Header */}
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2 text-accent">
                            <span className="material-symbols-outlined">key_off</span> Consent Overrides
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review "glass break" emergency access logs where consent was bypassed.</p>
                    </div>
                </header>

                {/* Right Floating Theme Toggle */}
                <div className="absolute top-6 right-8 z-[60]">
                    <ThemeToggle />
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide flex flex-col">

                    {/* Overrides Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {loading && overrides.length === 0 ? (
                            <div className="col-span-full flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                            </div>
                        ) : overrides.length === 0 ? (
                            <div className="col-span-full bg-surface dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm">
                                <span className="material-symbols-outlined text-5xl mb-4 opacity-40">health_and_safety</span>
                                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Active Overrides</h3>
                                <p>No emergency access overrides have been recorded.</p>
                            </div>
                        ) : (
                            overrides.map((override) => (
                                <div key={override.id} className="bg-surface dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-900/30 rounded-3xl p-6 shadow-sm transition hover:shadow-md relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4">
                                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${override.status === 'Pending Review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            }`}>
                                            {override.status}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 pr-32 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-rose-500">warning</span>
                                        Emergency Override
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                                <div>
                                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Doctor</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{override.doctor}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Accessed</span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200 font-mono text-[13px] bg-surface dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-200 dark:border-slate-700 inline-block">{override.patientId}</span>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Stated Reason</span>
                                                <p className="text-slate-600 dark:text-slate-300 italic">"{override.reason}"</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">calendar_clock</span>
                                                {formatDate(override.date)}
                                            </span>

                                            {override.status === 'Pending Review' && (
                                                <button className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-600 transition shadow-sm">
                                                    Escalate & Review
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ConsentOverrides;
