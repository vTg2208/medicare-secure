import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { labApi } from '../../api/labApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css';

import LabQueue from '../../components/lab/LabQueue';
import LabTestDetails from '../../components/lab/LabTestDetails';
import LabResultUpload from '../../components/lab/LabResultUpload';
import UploadedResultsTable from '../../components/lab/UploadedResultsTable';

function LabDashboard() {
    const { user, logout } = useContext(AuthContext);

    // States
    const [activeTab, setActiveTab] = useState('laboratory');
    const [tests, setTests] = useState([]);
    const [selectedTest, setSelectedTest] = useState(null);
    const [uploadedResults, setUploadedResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const [assignedTests, results] = await Promise.all([
                labApi.getAssignedLabTests(),
                labApi.getUploadedResults()
            ]);
            setTests(assignedTests || []);
            setUploadedResults(results || []);
        } catch (err) {
            setError('Failed to load lab data. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSuccess = () => {
        setSuccessMsg("Lab result uploaded successfully");
        setSelectedTest(null);
        setTimeout(() => setSuccessMsg(""), 4000);
        // Refresh data
        fetchData();
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">

            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/dashboard/lab'} />

                <nav className="space-y-2 flex-grow">
                    <button onClick={() => setActiveTab('laboratory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${activeTab === 'laboratory' ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                        <span className="material-symbols-outlined text-[20px]">science</span>
                        Laboratory
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition ${activeTab === 'history' ? 'sidebar-item-active text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Test History
                    </button>
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                <header className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Laboratory Dashboard</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                {user?.firstName || 'Lab'} {user?.lastName || 'Technician'} • Tech ID: {user?.id || 'N/A'}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl text-sm font-medium border border-rose-100 dark:border-rose-900/50">
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl text-sm font-medium border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        {successMsg}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <span className="material-symbols-outlined animate-spin text-4xl text-primary-500">progress_activity</span>
                    </div>
                ) : (
                    <>
                        {activeTab === 'laboratory' ? (
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                {/* Left Column (Wider) */}
                                <div className="xl:col-span-2 space-y-8">
                                    <LabQueue tests={tests} onSelect={setSelectedTest} />
                                </div>

                                {/* Right Column (Sidebar-like for Details & Upload) */}
                                <div className="space-y-8">
                                    {selectedTest ? (
                                        <>
                                            <LabTestDetails test={selectedTest} />
                                            <LabResultUpload test={selectedTest} onUploadSuccess={handleUploadSuccess} />
                                        </>
                                    ) : (
                                        <div className="glass-card rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                                            <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 mb-4">biotech</span>
                                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Test Selected</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[200px]">
                                                Select a test from the assigned requests queue to view details and upload results.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-6xl">
                                <UploadedResultsTable results={uploadedResults} />
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default LabDashboard;
