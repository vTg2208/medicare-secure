import Brand from '../../components/common/Brand';
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import insuranceApi from '../../api/insuranceApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

const navItems = [
    { label: 'Dashboard', icon: 'grid_view', path: '/insurance/dashboard' },
    { label: 'Claims', icon: 'receipt_long', path: '/insurance/claims' },
    { label: 'Coverage Check', icon: 'verified_user', path: '/insurance/coverage' },
    { label: 'Policyholders', icon: 'group', path: '/insurance/policyholders' },
];

function Policyholders() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useContext(AuthContext);

    const [policyholders, setPolicyholders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await insuranceApi.getPolicyholders();
                if (res.success) setPolicyholders(res.data);
            } catch (e) { undefined; }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };

    const filtered = policyholders.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.policyNumber.toLowerCase().includes(search.toLowerCase())
    );

    const statusBadge = (status) => status === 'Active'
        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
        : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';

    const typeBadge = (type) => {
        const map = {
            Premium: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
            Basic: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
            Family: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        };
        return map[type] || 'bg-slate-100 text-slate-600';
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/insurance/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    {navItems.map(item => (
                        <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${location.pathname === item.path ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/insurance/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 border-b border-transparent bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Policyholders</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{policyholders.length} insured members on file</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or policy…"
                                className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800/70 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-400 w-64"
                            />
                        </div>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    {loading && <p className="text-center text-slate-400 py-10">Loading members…</p>}
                    <div className="glass-card rounded-3xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800/60">
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Member</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Policy #</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Plan</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Coverage Period</th>
                                    <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {filtered.map(ph => (
                                    <tr key={ph.id} className="hover:bg-surface dark:hover:bg-surface transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-300 font-bold text-sm flex-shrink-0">
                                                    {ph.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{ph.name}</p>
                                                    <p className="text-xs text-slate-400">{ph.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{ph.policyNumber}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeBadge(ph.type)}`}>{ph.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{ph.coverageStart} → {ph.coverageEnd}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusBadge(ph.status)}`}>{ph.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!loading && filtered.length === 0 && (
                            <div className="py-10 text-center text-slate-400">No policyholders match your search.</div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Policyholders;
