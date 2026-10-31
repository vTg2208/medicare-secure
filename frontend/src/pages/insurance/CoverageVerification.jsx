import React, { useContext, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import insuranceApi from '../../api/insuranceApi';
import '../../pages/patient/Dashboard.css';

const navItems = [
    { label: 'Dashboard', icon: 'grid_view', path: '/insurance/dashboard' },
    { label: 'Claims', icon: 'receipt_long', path: '/insurance/claims' },
    { label: 'Coverage Check', icon: 'verified_user', path: '/insurance/coverage' },
    { label: 'Policyholders', icon: 'group', path: '/insurance/policyholders' },
];

function CoverageVerification() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useContext(AuthContext);

    const [queryType, setQueryType] = useState('policyNumber');
    const [queryValue, setQueryValue] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!queryValue.trim()) return;
        setLoading(true);
        setResult(null);
        setSearched(true);
        try {
            const params = queryType === 'memberId' ? { memberId: queryValue } : { policyNumber: queryValue };
            const res = await insuranceApi.verifyCoverage(params);
            if (res.success) setResult(res.data);
        } catch (err) { undefined; }
        finally { setLoading(false); }
    };

    const quickChecks = ['POL-123456', 'POL-654321', 'POL-111222', 'PH-001', 'PH-002'];

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/insurance/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    {navItems.map(item => (
                        <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${location.pathname === item.path ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'}`}>
                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/insurance/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full overflow-y-auto">
                <header className="px-8 py-6 flex-shrink-0 border-b border-transparent bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Coverage Verification</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Check real-time insurance coverage by policy number or member ID</p>
                </header>

                <div className="p-8 max-w-2xl mx-auto w-full">
                    {/* Search Form */}
                    <div className="glass-card p-8 rounded-3xl mb-6">
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setQueryType('policyNumber')} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${queryType === 'policyNumber' ? 'bg-blue-600 text-white' : 'glass-card text-slate-600 dark:text-slate-300'}`}>Policy Number</button>
                            <button onClick={() => setQueryType('memberId')} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${queryType === 'memberId' ? 'bg-blue-600 text-white' : 'glass-card text-slate-600 dark:text-slate-300'}`}>Member ID</button>
                        </div>
                        <form onSubmit={handleSearch} className="flex gap-3">
                            <input
                                type="text"
                                value={queryValue}
                                onChange={e => setQueryValue(e.target.value)}
                                placeholder={queryType === 'policyNumber' ? 'e.g. POL-123456' : 'e.g. PH-001'}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
                            />
                            <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">search</span>
                                {loading ? 'Checking…' : 'Verify'}
                            </button>
                        </form>

                        {/* Quick fill hints */}
                        <div className="mt-4">
                            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Try a sample:</p>
                            <div className="flex flex-wrap gap-2">
                                {quickChecks.map(q => (
                                    <button key={q} onClick={() => { setQueryValue(q); setQueryType(q.startsWith('PH') ? 'memberId' : 'policyNumber'); }} className="text-xs px-3 py-1 rounded-lg glass-card text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition font-mono">
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Result */}
                    {searched && !loading && result && (
                        <div className={`glass-card p-8 rounded-3xl border-2 ${result.covered ? 'border-emerald-300 dark:border-emerald-700' : 'border-rose-300 dark:border-rose-700'}`}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl ${result.covered ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600'}`}>
                                    <span className="material-symbols-outlined text-4xl">{result.covered ? 'verified' : 'cancel'}</span>
                                </div>
                                <div>
                                    <h3 className={`text-2xl font-bold ${result.covered ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                        {result.covered ? 'Coverage Active' : 'Not Covered'}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">{result.covered ? 'Patient has active insurance coverage.' : result.message || 'No active policy found.'}</p>
                                </div>
                            </div>

                            {result.policyDetails && (
                                <div className="space-y-3 mb-6">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Policy Details</h4>
                                    {[
                                        { label: 'Member Name', val: result.policyDetails.name },
                                        { label: 'Policy Number', val: result.policyDetails.policyNumber },
                                        { label: 'Plan Type', val: result.policyDetails.type },
                                        { label: 'Status', val: result.policyDetails.status },
                                        { label: 'Coverage Period', val: `${result.policyDetails.coverageStart} → ${result.policyDetails.coverageEnd}` },
                                    ].map(r => (
                                        <div key={r.label} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/50">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">{r.label}</span>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {result.covered && (
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                    {[
                                        { label: 'Copay', val: `$${result.copay}` },
                                        { label: 'Deductible Used', val: `$${result.deductibleUsed}` },
                                        { label: 'Deductible Total', val: `$${result.deductibleTotal}` },
                                    ].map(item => (
                                        <div key={item.label} className="glass-card p-3 rounded-2xl text-center">
                                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
                                            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{item.val}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default CoverageVerification;
