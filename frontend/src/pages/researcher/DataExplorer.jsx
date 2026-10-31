import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import { researchApi } from '../../services/researchApi';
import '../patient/Dashboard.css';

function DataExplorer() {
    const navigate = useNavigate();
    const [symptoms, setSymptoms] = useState([]);
    const [treatments, setTreatments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [activeTab, setActiveTab] = useState('symptoms'); // 'symptoms' or 'treatments'

    const {  logout } = useAuth();

    useEffect(() => {
        const fetchExplorerData = async () => {
            try {
                const [symData, trtData] = await Promise.all([
                    researchApi.getSymptoms(),
                    researchApi.getTreatments()
                ]);
                if (symData.success) setSymptoms(symData.data);
                if (trtData.success) setTreatments(trtData.data);
            } catch (error) {
                setLoadError('Unable to load research data. Please reload and retry.');
            } finally {
                setLoading(false);
            }
        };
        fetchExplorerData();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/researcher/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">science</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>

                <nav className="space-y-2 flex-grow">
                    <Link to="/researcher/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">insights</span>
                        Global Stats
                    </Link>
                    <Link to="/researcher/explorer" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800 shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">query_stats</span>
                        Data Explorer
                    </Link>
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-white/20 dark:border-slate-800/50">
                    <Link to="/researcher/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
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
            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                {loadError && <p role="alert" className="mb-4 text-rose-600">{loadError}</p>}
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Data Explorer</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium tracking-wide">
                                Analyze macro-trends across aggregated health datasets
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                        </div>
                    </div>
                </header>

                <div className="glass-card rounded-3xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
                    <div className="flex border-b border-slate-200 dark:border-slate-700/50 px-6 pt-4">
                        <button
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'symptoms' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            onClick={() => setActiveTab('symptoms')}
                        >
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px]">coronavirus</span>
                                Symptom Frequency
                            </div>
                        </button>
                        <button
                            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'treatments' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                            onClick={() => setActiveTab('treatments')}
                        >
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px]">vaccines</span>
                                Treatment Efficacy
                            </div>
                        </button>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="py-20 text-center text-slate-500">Querying global datasets...</div>
                        ) : activeTab === 'symptoms' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                                            <th className="py-4 px-4 font-medium uppercase tracking-wider">Reported Symptom</th>
                                            <th className="py-4 px-4 font-medium uppercase tracking-wider">Occurrences</th>
                                            <th className="py-4 px-4 font-medium uppercase tracking-wider">Avg. Severity (1-10)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {symptoms.map((sym, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                <td className="py-4 px-4 font-medium text-slate-800 dark:text-slate-200">{sym.name}</td>
                                                <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                                                    <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-3 py-1 rounded-full text-sm font-medium">
                                                        {sym.count.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-600 dark:text-slate-300 font-medium">{sym.severityAvg ?? 'Not measured'}</span>
                                                        <div hidden={sym.severityAvg == null} className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                                            <div className={`h-2 rounded-full ${sym.severityAvg > 6 ? 'bg-rose-500' : sym.severityAvg > 4 ? 'bg-amber-500' : 'bg-teal-500'}`} style={{ width: `${sym.severityAvg * 10}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                                            <th className="py-4 px-4 font-medium uppercase tracking-wider">Treatment Protocol</th>
                                            <th className="py-4 px-4 font-medium uppercase tracking-wider">Prescriptions Logged</th>
                                            <th className="py-4 px-4 font-medium uppercase tracking-wider">Success Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {treatments.map((trt, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                                <td className="py-4 px-4 font-medium text-slate-800 dark:text-slate-200">{trt.name}</td>
                                                <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                                                    <span className="bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 px-3 py-1 rounded-full text-sm font-medium">
                                                        {trt.usageCount.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-600 dark:text-slate-300 font-medium">{trt.successRate == null ? 'Not measured' : `${trt.successRate}%`}</span>
                                                        <div hidden={trt.successRate == null} className="w-32 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                                            <div className={`h-2 rounded-full ${trt.successRate > 80 ? 'bg-teal-500' : trt.successRate > 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${trt.successRate ?? 0}%` }}></div>
                                                        </div>
                                                    </div>
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
}

export default DataExplorer;
