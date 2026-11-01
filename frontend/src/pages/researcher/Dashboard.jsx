import Brand from '../../components/common/Brand';
import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import { researchApi } from '../../services/researchApi';
import '../patient/Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalRecords: 0,
        activeStudies: 0,
        anonymizedPatients: 0,
        dataPointsCollected: 0
    });
    const [demographics, setDemographics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const { user, logout } = useAuth();

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsData, demographicData] = await Promise.all([
                    researchApi.getStats(),
                    researchApi.getDemographics()
                ]);
                if (statsData.success) setStats(statsData.data);
                if (demographicData.success) setDemographics(demographicData.data);
            } catch (error) {
                setLoadError('Unable to load research data. Please reload and retry.');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/researcher/dashboard'} />

                <nav className="space-y-2 flex-grow">
                    <Link to="/researcher/dashboard" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800 shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">insights</span>
                        Global Stats
                    </Link>
                    <Link to="/researcher/explorer" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">query_stats</span>
                        Data Explorer
                    </Link>
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-line dark:border-slate-800/50">
                    <Link to="/researcher/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
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
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Research Hub</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium tracking-wide">
                                Welcome back, {user?.firstName || 'Researcher'} {user?.lastName || ''} • Consent-based aggregate data
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl border border-primary-200 dark:border-primary-800/30">
                                <span className="material-symbols-outlined text-primary-500 dark:text-primary-400 text-lg">verified_user</span>
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Aggregated research data</span>
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {[
                            { label: "Eligible cohort patients", value: loading ? "..." : (stats.anonymizedPatients == null ? 'Suppressed' : stats.anonymizedPatients.toLocaleString()), icon: "group", classes: "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" },
                            { label: "Total Records", value: loading ? "..." : (stats.totalRecords == null ? 'Suppressed' : stats.totalRecords.toLocaleString()), icon: "folder_shared", classes: "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" },
                            { label: "Active Studies", value: loading ? "..." : (stats.activeStudies == null ? 'Suppressed' : stats.activeStudies.toLocaleString()), icon: "auto_stories", classes: "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" },
                            { label: "Data Points", value: loading ? "..." : (stats.dataPointsCollected == null ? 'Suppressed' : stats.dataPointsCollected.toLocaleString()), icon: "data_usage", classes: "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" }
                        ].map((stat, i) => (
                            <div key={i} className="glass-card p-5 rounded-3xl group transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${stat.classes}`}>
                                        <span className="material-symbols-outlined">{stat.icon}</span>
                                    </div>
                                </div>
                                <h4 className="text-2xl font-bold mb-1 text-slate-800 dark:text-slate-100 tracking-tight">{stat.value}</h4>
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Age Demographics */}
                        <div className="glass-card p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500">bar_chart</span>
                                Age Distribution
                            </h3>
                            {loading ? (
                                <div className="h-40 flex items-center justify-center text-slate-500">Loading data...</div>
                            ) : demographics?.ageGroups ? (
                                <div className="space-y-4">
                                    {demographics.ageGroups.map((group, idx) => (
                                        <div key={idx}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-slate-600 dark:text-slate-400">{group.range} Years</span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{group.percentage}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                                <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${group.percentage}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {/* Gender Demographics */}
                        <div className="glass-card p-6 rounded-3xl border border-slate-200/50 dark:border-slate-700/50">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary-500">pie_chart</span>
                                Gender Overview
                            </h3>
                            {loading ? (
                                <div className="h-40 flex items-center justify-center text-slate-500">Loading data...</div>
                            ) : demographics?.gender ? (
                                <div className="flex flex-col gap-4">
                                    {demographics.gender.map((g, idx) => (
                                        <div key={idx} className="flex items-center p-3 glass-card rounded-xl">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-4">
                                                <span className="material-symbols-outlined text-sm text-slate-500">person</span>
                                            </div>
                                            <div className="flex-grow">
                                                <h4 className="font-medium text-slate-800 dark:text-slate-200">{g.category}</h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{g.percentage}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </header>
            </main>
        </div>
    );
}

export default Dashboard;
