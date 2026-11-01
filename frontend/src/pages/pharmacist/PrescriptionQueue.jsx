import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { pharmacistApi } from '../../api/pharmacistApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const PrescriptionQueue = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pending, dispensed
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState('');

    const fetchPrescriptions = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const response = await pharmacistApi.getPrescriptions(filter);
            if (response && response.success) {
                setPrescriptions(response.data);
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Unable to load prescriptions. Please retry.');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

    const handleDispense = async (id) => {
        try {
            setProcessingId(id);
            setError('');
            const response = await pharmacistApi.dispensePrescription(id);
            if (response && response.success) {
                // Refresh list
                fetchPrescriptions();
            }
        } catch (error) {
            setError(error.response?.data?.message || 'Unable to dispense this prescription. Please retry.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/pharmacist/dashboard' },
        { id: 'prescriptions', label: 'Prescriptions', icon: 'prescriptions', path: '/pharmacist/prescriptions' },
        { id: 'inventory', label: 'Inventory', icon: 'inventory_2', path: '/pharmacist/inventory' },
        { id: 'audit', label: 'Audit Logs', icon: 'history_edu', path: '/pharmacist/audit-logs' }
    ];

    if (loading && prescriptions.length === 0) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--background-light)] dark:bg-[var(--background-dark)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto z-20 bg-[var(--background-light)] dark:bg-[var(--background-dark)] relative mc-sidebar">
                {/* Logo Area */}
                <Brand to={'/pharmacist/dashboard'} />

                {/* Navigation Links */}
                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || location.pathname.includes(item.path);

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? "bg-primary-50/80 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 shadow-sm"
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${isActive ? '' : ''}`}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Profile & Logout */}
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/pharmacist/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl font-medium">
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


                {/* Header (Sticky Header) */}
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 border-b border-transparent transition-all pr-[80px]">
                    <div>
                        <h2 className="text-2xl font-bold text-accent">Prescription Queue</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage and dispense medical prescriptions</p>
                    </div>
                </header>

                {/* Right Floating Theme Toggle */}
                <div className="absolute top-6 right-8 z-[60]">
                    <ThemeToggle />
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide flex flex-col">

                    {/* Filters & Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                            {['all', 'pending', 'dispensed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 font-medium text-sm rounded-lg capitalize transition-colors ${filter === f
                                        ? 'bg-surface dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/50 dark:border-slate-600/50'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-emerald-500'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Prescriptions List */}
                    {error && <p role="alert" className="mb-4 text-[var(--mc-danger)]">{error}</p>}
                    <div className="bg-surface dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm flex-1 flex flex-col relative z-10">
                        {loading && prescriptions.length > 0 && (
                            <div className="absolute inset-0 bg-surface dark:bg-slate-900/50 z-20 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        )}

                        {prescriptions.length === 0 && !loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-center">
                                <span className="material-symbols-outlined text-6xl mb-4 opacity-30">check_circle</span>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Queue Empty</h3>
                                <p className="max-w-md mx-auto">No {filter !== 'all' ? filter : ''} prescriptions found at this time.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto p-2">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800/80">
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 rounded-tl-xl">Rx ID</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Patient</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Medication</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Prescriber</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 text-right rounded-tr-xl">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {prescriptions.map((rx) => (
                                            <tr
                                                key={rx.id}
                                                className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{rx.id}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{rx.patientName}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{rx.patientId}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800 dark:text-slate-200">{rx.medication}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={rx.dosage}>{rx.dosage}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-800 dark:text-slate-200">{rx.prescribedBy}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${rx.status === 'pending'
                                                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                                                        : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                                        }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${rx.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                                        {rx.status.charAt(0).toUpperCase() + rx.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {['pending', 'active'].includes(rx.status) ? (
                                                        <button
                                                            onClick={() => handleDispense(rx.id)}
                                                            disabled={processingId === rx.id}
                                                            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50"
                                                        >
                                                            {processingId === rx.id ? (
                                                                <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
                                                            ) : (
                                                                <>Dispense</>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 dark:text-slate-500">{rx.status}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PrescriptionQueue;
