import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { complianceApi } from '../../api/complianceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const Incidents = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        try {
            setLoading(true);
            const response = await complianceApi.getIncidents();
            if (response && response.success) {
                setIncidents(response.data);
            }
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (incidentId, newStatus) => {
        try {
            setUpdating(incidentId);
            const response = await complianceApi.updateIncidentStatus(incidentId, newStatus);
            if (response.success) {
                // Update local state
                setIncidents(incidents.map(inc =>
                    inc.id === incidentId ? { ...inc, status: newStatus } : inc
                ));
            }
        } catch (error) {
        } finally {
            setUpdating(null);
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
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative">
                {/* Logo Area */}
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/compliance/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-slate-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-slate-800 dark:bg-slate-700 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(71,85,105,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">admin_panel_settings</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:drop-shadow-[0_0_10px_rgba(71,85,105,0.4)]">Medicare</h1>
                </div>

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
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'
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
                    <Link to="/compliance/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition rounded-xl font-medium"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-slate-400/5 dark:bg-slate-600/5 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                {/* Header */}
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 flex items-center gap-2">
                            <span className="material-symbols-outlined">gavel</span> Security Incidents
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review, manage, and resolve reported privacy and security violations</p>
                    </div>
                </header>

                {/* Right Floating Theme Toggle */}
                <div className="absolute top-6 right-8 z-[60]">
                    <ThemeToggle />
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide flex flex-col">

                    {/* Incidents List */}
                    <div className="space-y-4">
                        {loading && incidents.length === 0 ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
                            </div>
                        ) : incidents.length === 0 ? (
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-12 text-center text-slate-500 dark:text-slate-400 shadow-sm">
                                <span className="material-symbols-outlined text-5xl mb-4 opacity-40">verified_user</span>
                                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">System Secure</h3>
                                <p>No security or privacy incidents are currently logged.</p>
                            </div>
                        ) : (
                            incidents.map((incident) => (
                                <div key={incident.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm transition hover:shadow-md relative overflow-hidden group">
                                    {/* Color Indicator Strip */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${incident.status === 'Open' ? 'bg-rose-500' :
                                            incident.status === 'Investigating' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}></div>

                                    <div className="flex justify-between items-start mb-4 pl-3">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{incident.type}</h3>
                                                <span className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-500 shadow-sm bg-slate-50 dark:bg-slate-800">
                                                    {incident.id}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                                {formatDate(incident.date)}
                                            </p>
                                        </div>

                                        {/* Status Dropdown */}
                                        <div className="flex items-center gap-3">
                                            {updating === incident.id && <span className="animate-spin h-4 w-4 border-b-2 border-slate-500 rounded-full"></span>}
                                            <select
                                                value={incident.status}
                                                onChange={(e) => handleStatusChange(incident.id, e.target.value)}
                                                disabled={updating === incident.id}
                                                className={`appearance-none bg-transparent font-bold text-sm px-4 py-2 pr-8 rounded-xl border focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer ${incident.status === 'Open' ? 'bg-rose-50/50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' :
                                                        incident.status === 'Investigating' ? 'bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                                                            'bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                    }`}
                                            >
                                                <option value="Open" className="text-slate-800 dark:text-white bg-white dark:bg-slate-800">🔴 Open</option>
                                                <option value="Investigating" className="text-slate-800 dark:text-white bg-white dark:bg-slate-800">🟡 Investigating</option>
                                                <option value="Resolved" className="text-slate-800 dark:text-white bg-white dark:bg-slate-800">🟢 Resolved</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pl-3">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-4 border border-slate-100 dark:border-slate-700/50">
                                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Description of Events</h4>
                                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                                                {incident.description}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl inline-flex border border-slate-200 dark:border-slate-700">
                                            <span className="material-symbols-outlined text-[16px]">record_voice_over</span>
                                            Reported By: <span className="font-semibold text-slate-700 dark:text-slate-200">{incident.reporter}</span>
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

export default Incidents;
