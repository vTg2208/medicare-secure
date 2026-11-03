import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { AdminSidebar } from './HospitalAdminDashboard';
import ThemeToggle from '../../components/common/ThemeToggle';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import Pagination from '../../components/common/Pagination';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import '../patient/Dashboard.css';

const ROLE_COLORS = {
    system_admin: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    hospital_admin: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    doctor: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    nurse: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    patient: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    receptionist: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function UserManagement() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const search = useDebouncedValue(searchTerm.trim());
    const queryKey = JSON.stringify([search, filterRole, filterStatus]);
    const [paging, setPaging] = useState({ key: '', page: 1 });
    const page = paging.key === queryKey ? paging.page : 1;
    const sequence = useRef(0);
    const invalidateRequests = useCallback(() => { sequence.current++; }, []);
    const pageSize = 20;

    const fetchUsers = useCallback(async () => {
        const request = ++sequence.current;
        try {
            setLoading(true);
            setError('');
            const data = await userApi.getAllUsers(filterRole === 'all' ? null : filterRole, {
                limit: pageSize, offset: (page - 1) * pageSize,
                search: search || undefined, status: filterStatus === 'all' ? undefined : filterStatus
            });
            if (request !== sequence.current) return;
            if (!data?.success) throw new Error('Unable to load users');
            setUsers(data.data || []);
            setTotal(data.pagination?.total ?? data.data?.length ?? 0);
        } catch (error) {
            if (request !== sequence.current) return;
            setError('Unable to load users. Please retry.');
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                alert('Session expired. Please log in again.');
                navigate('/login');
            }
        } finally {
            if (request === sequence.current) setLoading(false);
        }
    }, [navigate, page, search, filterRole, filterStatus]);

    useEffect(() => { fetchUsers(); return invalidateRequests; }, [fetchUsers, invalidateRequests, refresh]);

    const handleDeactivate = async (userId) => {
        if (!window.confirm('Are you sure you want to deactivate this user?')) return;
        try {
            const data = await userApi.deactivateStaff(userId);
            if (!data.success) throw new Error(data.message);
            alert('User deactivated successfully');
            setRefresh(value => value + 1);
        } catch (error) {
            alert(error.response?.data?.message || error.message || 'Error deactivating user');
        }
    };

    const filteredUsers = users;

    const selectCls = "px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme"><ThemeToggle /></div>
            <AdminSidebar active="/admin/users" />

            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage user accounts, roles, and access permissions</p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-surface dark:hover:bg-slate-800 transition-all text-sm font-bold shadow-sm group"
                    >
                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        Back to Dashboard
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="glass-card p-5 rounded-2xl border border-primary-100 dark:border-primary-900/30 bg-primary-50/50 dark:bg-primary-900/10">
                        <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{filteredUsers.length}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Users on this page</p>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{filteredUsers.filter(u => u.is_active).length}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Active on this page</p>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10">
                        <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{filteredUsers.filter(u => !u.is_active).length}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Inactive on this page</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <input
                        type="text"
                        aria-label="Search users"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`flex-grow min-w-[200px] ${selectCls}`}
                    />
                    <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className={selectCls}>
                        <option value="all">All Roles</option>
                        <option value="system_admin">System Admin</option>
                        <option value="hospital_admin">Hospital Admin</option>
                        <option value="doctor">Doctor</option>
                        <option value="nurse">Nurse</option>
                        <option value="patient">Patient</option>
                        <option value="receptionist">Receptionist</option>
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                {/* Table */}
                <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {loading ? (
                        <LoadingSkeleton label="Loading users" />
                    ) : error ? <div role="alert" className="p-6">{error} <button onClick={fetchUsers}>Retry</button></div> : filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                            <span className="material-symbols-outlined text-4xl">group_off</span>
                            <p className="text-sm">No users found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">User</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Email</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Role</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Joined</th>
                                        <th className="text-right px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{user.first_name} {user.last_name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-600'}`}>
                                                    {user.role?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit ${user.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(user.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                {user.is_active && user.role !== 'system_admin' && (
                                                    <button
                                                        onClick={() => handleDeactivate(user.id)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 transition"
                                                    >
                                                        Deactivate
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <Pagination page={page} pageSize={pageSize} total={total} busy={loading || Boolean(error)} onPageChange={next => setPaging({ key: queryKey, page: next })} />
            </main>
        </div>
    );
}

export default UserManagement;
