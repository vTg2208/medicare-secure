// Workflow Dashboard - Epic 4: Clinical Workflow
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import { workflowApi } from '../../api/workflowApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css'; // Shared dashboard theme
import './WorkflowDashboard.css';

function WorkflowDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [beds, setBeds] = useState([]);
    const [notifications, setNotifications] = useState([]);

    // Determine back destination based on role
    const isAdmin = ['ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN'].includes(user?.role?.toUpperCase());
    const backPath = isAdmin ? '/admin/dashboard' : '/staff/dashboard';



    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bedsData, notifs] = await Promise.all([
                workflowApi.getAvailableBeds(),
                workflowApi.getUserNotifications(true),
                // workflowApi.getWorkflowLogs() // API might not be exposed to all roles, handled gracefully
            ]);

            setBeds(bedsData.data || bedsData || []);
            setNotifications(notifs.data || notifs || []);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleAllocateBed = async () => {
        // Simple prompt for demo - in real app would be a modal
        const visitId = prompt("Enter Patient Visit ID:");
        if (!visitId) return;

        const ward = prompt("Enter Ward (e.g., General, ICU):", "General");
        const bed = prompt("Enter Bed Number:", "101");

        try {
            await workflowApi.allocateBed(visitId, ward, '1', bed, 'Allocated via Dashboard');
            alert('Bed allocated successfully!');
            fetchData();
        } catch (err) {
            alert('Failed to allocate bed: ' + err.message);
        }
    };

    const navToVisits = () => {
        if (user?.role === 'receptionist' || user?.roleName === 'receptionist') {
            navigate('/receptionist/visits');
        } else {
            navigate('/staff/visit-queue');
        }
    };

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto w-full md:w-64 z-20">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate(backPath)}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    <button onClick={() => navigate(backPath)} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Overview
                    </button>
                    {!isAdmin && (
                        <>
                            <button onClick={navToVisits} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                                <span className="material-symbols-outlined text-[20px]">fact_check</span>
                                Visit Management
                            </button>
                            {['receptionist', 'nurse', 'staff'].includes(user?.role) && (
                                <Link to="/staff/registration" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                                    Patient Registration
                                </Link>
                            )}
                        </>
                    )}
                    <Link to="/staff/workflow" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-800 shadow-sm">
                        <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                        Clinical Workflow
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <button onClick={logout} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-xl font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Clinical Workflow Ops</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Real-time resource and task management
                            </p>
                        </div>
                    </div>
                </header>

                <div className="glass-card rounded-3xl p-8 max-w-7xl mx-auto shadow-sm">
                    <div className="workflow-grid">
                        {/* Bed Management Card */}
                        <div className="glass-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">🛏️ Bed Management</h2>
                                <Button onClick={handleAllocateBed} size="small">+ Allocate</Button>
                            </div>
                            <div>
                                {loading ? <p className="text-slate-500 dark:text-slate-400">Loading beds...</p> : (
                                    <div>
                                        <div className="flex gap-8 mb-6">
                                            <div className="flex flex-col">
                                                <span className="text-4xl font-bold text-sky-500">{beds.length}</span>
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Available Beds</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-4xl font-bold text-sky-500">{beds.filter(b => b.ward === 'ICU').length}</span>
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">ICU Vacancy</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {beds.length > 0 ? (
                                                beds.slice(0, 5).map((bed, i) => (
                                                    <div key={i} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-100/50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                        {bed.ward} - Bed {bed.bedNumber}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-slate-500 dark:text-slate-400">No beds available</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notifications / Tasks */}
                        <div className="glass-card rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white m-0 flex items-center gap-2">🔔 Active Tasks</h2>
                            </div>
                            <div>
                                {notifications.length === 0 ? (
                                    <p className="text-slate-500 dark:text-slate-400">No active tasks</p>
                                ) : (
                                    <ul className="m-0 p-0 list-none space-y-2">
                                        {notifications.map(n => (
                                            <li key={n.id} className={`p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center ${n.priority === 'high' ? 'border-l-4 border-l-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{n.message}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(n.created_at).toLocaleTimeString()}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default WorkflowDashboard;
