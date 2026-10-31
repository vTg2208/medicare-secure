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

function ClaimsManagement() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout } = useContext(AuthContext);

    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [actionNote, setActionNote] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await insuranceApi.getClaims();
                if (res.success) setClaims(res.data);
            } catch (e) { undefined; }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };

    const filteredClaims = filter === 'All' ? claims : claims.filter(c => c.status === filter);

    const handleUpdateClaim = async (status) => {
        if (!selectedClaim) return;
        setProcessing(true);
        try {
            const res = await insuranceApi.updateClaim(selectedClaim.id, { status, notes: actionNote });
            if (res.success) {
                setClaims(prev => prev.map(c => c.id === selectedClaim.id ? res.data : c));
                setSelectedClaim(res.data);
                setActionNote('');
            }
        } catch (e) { undefined; }
        finally { setProcessing(false); }
    };

    const statusBadge = (status) => {
        const map = {
            Pending: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
            Approved: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
            Denied: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
        };
        return map[status] || 'bg-slate-100 text-slate-600';
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md border-b border-transparent">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Claims Management</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{claims.length} total claims on file</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            {['All', 'Pending', 'Approved', 'Denied'].map(f => (
                                <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${filter === f ? 'bg-blue-600 text-white shadow-md' : 'glass-card text-slate-600 dark:text-slate-300 hover:bg-white/70'}`}>{f}</button>
                            ))}
                        </div>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 flex gap-6">
                    {/* Claims List */}
                    <div className="flex-1">
                        {loading && <p className="text-center text-slate-400 py-10">Loading…</p>}
                        {!loading && filteredClaims.length === 0 && <p className="text-center text-slate-400 py-10">No claims found.</p>}
                        <div className="space-y-3">
                            {filteredClaims.map(claim => (
                                <div key={claim.id} onClick={() => setSelectedClaim(claim)} className={`glass-card p-5 rounded-2xl cursor-pointer hover:shadow-md transition-all border-2 ${selectedClaim?.id === claim.id ? 'border-blue-400 dark:border-blue-600' : 'border-transparent'}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{claim.patientName}</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{claim.id} · {claim.policyNumber}</p>
                                        </div>
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusBadge(claim.status)}`}>{claim.status}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500 dark:text-slate-400">{claim.diagnosis}</span>
                                        <span className="font-bold text-lg text-slate-800 dark:text-slate-100">${claim.amount.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Submitted {formatDate(claim.submittedAt)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detail Panel */}
                    {selectedClaim && (
                        <div className="w-80 flex-shrink-0 glass-card rounded-3xl p-6 h-fit">
                            <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Claim Detail</h3>
                            <div className="space-y-3 mb-6">
                                {[
                                    { label: 'Claim ID', val: selectedClaim.id },
                                    { label: 'Patient', val: selectedClaim.patientName },
                                    { label: 'Policy #', val: selectedClaim.policyNumber },
                                    { label: 'Diagnosis', val: selectedClaim.diagnosis },
                                    { label: 'Amount', val: `$${selectedClaim.amount.toFixed(2)}` },
                                    { label: 'Status', val: selectedClaim.status },
                                    { label: 'Submitted', val: formatDate(selectedClaim.submittedAt) },
                                ].map(row => (
                                    <div key={row.label} className="flex justify-between">
                                        <span className="text-xs text-slate-400 font-semibold uppercase">{row.label}</span>
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{row.val}</span>
                                    </div>
                                ))}
                                {selectedClaim.notes && (
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-xs text-slate-400 font-semibold uppercase mb-1">Notes</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">{selectedClaim.notes}</p>
                                    </div>
                                )}
                            </div>
                            {selectedClaim.status === 'Pending' && (
                                <div className="space-y-3">
                                    <textarea
                                        value={actionNote}
                                        onChange={e => setActionNote(e.target.value)}
                                        placeholder="Add notes (e.g. reason for denial)…"
                                        rows={3}
                                        className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                    <button
                                        onClick={() => handleUpdateClaim('Approved')}
                                        disabled={processing}
                                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-50"
                                    >
                                        {processing ? 'Processing…' : '✓ Approve Claim'}
                                    </button>
                                    <button
                                        onClick={() => handleUpdateClaim('Denied')}
                                        disabled={processing}
                                        className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition disabled:opacity-50"
                                    >
                                        {processing ? 'Processing…' : '✕ Deny Claim'}
                                    </button>
                                </div>
                            )}
                            {selectedClaim.status !== 'Pending' && (
                                <p className="text-center text-sm text-slate-400">This claim has been {selectedClaim.status.toLowerCase()}.</p>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default ClaimsManagement;
