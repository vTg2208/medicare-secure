import Brand from '../../components/common/Brand';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { pharmacistApi } from '../../api/pharmacistApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const Inventory = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const response = await pharmacistApi.getInventory();
            if (response && response.success) {
                setInventory(response.data);
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
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/pharmacist/dashboard' },
        { id: 'prescriptions', label: 'Prescriptions', icon: 'prescriptions', path: '/pharmacist/prescriptions' },
        { id: 'inventory', label: 'Inventory', icon: 'inventory_2', path: '/pharmacist/inventory' },
        { id: 'audit', label: 'Audit Logs', icon: 'history_edu', path: '/pharmacist/audit-logs' }
    ];

    if (loading && inventory.length === 0) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[var(--background-light)] dark:bg-[var(--background-dark)]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    // Sort by status to bring Out of Stock / Low Stock up top.
    const getStatusWeight = (status) => {
        if (status === 'Out of Stock') return 2;
        if (status === 'Low Stock') return 1;
        return 0; // In Stock
    };

    const sortedInventory = [...inventory].sort((a, b) => getStatusWeight(b.status) - getStatusWeight(a.status));

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
                        <h2 className="text-2xl font-bold text-accent">Medication Inventory</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Monitor dispensing stock and active shortages</p>
                    </div>
                </header>

                {/* Right Floating Theme Toggle */}
                <div className="absolute top-6 right-8 z-[60]">
                    <ThemeToggle />
                </div>

                {/* Scrollable Content Container */}
                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide flex flex-col">

                    {/* Inventory List */}
                    <div className="bg-surface dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm flex-1 flex flex-col relative z-10">
                        {loading && inventory.length > 0 && (
                            <div className="absolute inset-0 bg-surface dark:bg-slate-900/50 z-20 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        )}

                        <div className="overflow-x-auto p-2">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-800/80">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 rounded-tl-xl">Medicine</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Category</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Location</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20">Stock</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-800/20 text-right rounded-tr-xl">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedInventory.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">Generic: {item.genericName}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {item.category}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                                                {item.location}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-mono text-lg font-bold ${item.stock === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>{item.stock}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${item.status === 'Out of Stock' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' :
                                                    item.status === 'Low Stock' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' :
                                                        'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Inventory;
