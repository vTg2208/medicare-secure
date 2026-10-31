import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { nurseApi } from '../../api/nurseApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../../pages/patient/Dashboard.css'; // Reusing global structural styles

const AssignedPatients = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const patientsData = await nurseApi.getAssignedPatients();
                if (patientsData && patientsData.success) {
                    setPatients(patientsData.data || []);
                } else {
                    setPatients([]);
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Navigation configuration
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/nurse/dashboard' },
        { id: 'patients', label: 'Assigned Patients', icon: 'group', path: '/nurse/patients' },
        { id: 'vitals', label: 'Vitals & Notes', icon: 'monitor_heart', path: '/nurse/vitals' },
        { id: 'medications', label: 'Medications', icon: 'medication', path: '/nurse/medications' },
        { id: 'schedule', label: 'Shift Schedule', icon: 'calendar_month', path: '/nurse/schedule' },
    ];

    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'stable':
                return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'check_circle', label: 'Stable' };
            case 'attention':
                return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'schedule', label: 'Needs Attention' };
            case 'critical':
                return { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: 'error', label: 'Critical' };
            default:
                return { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: 'monitor_heart', label: status || 'Unknown' };
        }
    };

    const filteredPatients = patients.filter(p => {
        const matchesSearch = p.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.condition?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === 'all' || p.status?.toLowerCase() === statusFilter.toLowerCase();

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            {/* Theme Toggle styling */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Left Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/nurse/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-teal-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(20,184,166,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">medical_services</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:drop-shadow-[0_0_10px_rgba(20,184,166,0.4)]">Medicare</h1>
                </div>

                <nav className="space-y-2 flex-grow">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path || (item.path === '/nurse/patients' && location.pathname.includes('/nurse/patients'));

                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                    ? 'bg-teal-50/80 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-800/50 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${isActive ? '' : ''}`}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/nurse/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl font-medium">
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

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 dark:bg-teal-400/5 rounded-full blur-3xl -z-10 transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

                <header className="px-8 py-6 flex items-center justify-between flex-shrink-0 z-10 sticky top-0 bg-[var(--background-light)]/80 dark:bg-[var(--background-dark)]/80 backdrop-blur-md border-b border-transparent transition-all">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300">Assigned Patients</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage and monitor your current patient queue</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 scrollbar-hide">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Controls */}
                        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/60 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm backdrop-blur-xl">
                            <div className="relative w-full sm:w-96">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                                <input
                                    type="text"
                                    placeholder="Search by name, room, or condition..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-shadow dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <div className="relative flex-1 sm:flex-none">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">filter_list</span>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full appearance-none pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer"
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="stable">Stable</option>
                                        <option value="attention">Needs Attention</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
                                </div>
                            </div>
                        </div>

                        {/* Patient Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filteredPatients.length > 0 ? (
                                    filteredPatients.map(patient => {
                                        const statusConfig = getStatusConfig(patient.status);

                                        return (
                                            <div key={patient.id} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-6 flex flex-col hover:border-teal-300/80 dark:hover:border-teal-700 transition-all shadow-sm hover:shadow-md cursor-pointer group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                                            {patient.firstName} {patient.lastName}
                                                        </h3>
                                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                            Room {patient.room}
                                                        </span>
                                                    </div>
                                                    <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                                                        <span className="material-symbols-outlined text-[14px]">{statusConfig.icon}</span>
                                                        {statusConfig.label}
                                                    </div>
                                                </div>

                                                <div className="space-y-3 mb-6 flex-1">
                                                    <div className="bg-slate-50/80 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 uppercase tracking-wider">Condition</div>
                                                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                            {patient.condition || 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 pt-2">
                                                        <span className="material-symbols-outlined text-[18px] text-teal-500">schedule</span>
                                                        <span>Next Check: <strong className="text-slate-900 dark:text-slate-200 ml-1">{new Date(patient.nextCheck).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                                    <button
                                                        onClick={() => navigate(`/nurse/patients/${patient.id}/records`)}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 dark:text-teal-400 text-sm font-medium rounded-xl transition-colors border border-teal-200 dark:border-teal-800/50">
                                                        <span className="material-symbols-outlined text-[18px]">assignment</span>
                                                        View Records
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full py-20 text-center">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4 ring-8 ring-slate-50 dark:ring-slate-900">
                                            <span className="material-symbols-outlined text-[32px] text-slate-400">group_off</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No patients found</h3>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                            {searchQuery ? 'Try adjusting your search criteria or clearing filters to find what you are looking for.' : 'You have no patients assigned to you right now.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AssignedPatients;
