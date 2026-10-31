import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../../api/userApi';
import { AdminSidebar } from './HospitalAdminDashboard';
import ThemeToggle from '../../components/common/ThemeToggle';
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

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await userApi.getAllUsers();
            if (data && data.success) setUsers(data.data || []);
            else undefined;
        } catch (error) {
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                alert('Session expired. Please log in again.');
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleDeactivate = async (userId) => {
        if (!window.confirm('Are you sure you want to deactivate this user?')) return;
        try {
            const data = await userApi.deactivateStaff(userId);
            if (data.success) { alert('User deactivated successfully'); fetchUsers(); }
            else alert('Failed to deactivate user: ' + data.message);
        } catch (error) { undefined; alert('Error deactivating user'); }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role === filterRole;
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && user.is_active) ||
            (filterStatus === 'inactive' && !user.is_active);
        return matchesSearch && matchesRole && matchesStatus;
    });

    const selectCls = "px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50"><ThemeToggle /></div>
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
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all text-sm font-bold shadow-sm group"
                    >
                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        Back to Dashboard
                    </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="glass-card p-5 rounded-2xl border border-violet-100 dark:border-violet-900/30 bg-violet-50/50 dark:bg-violet-900/10">
                        <p className="text-3xl font-black text-violet-600 dark:text-violet-400">{filteredUsers.length}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Users</p>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                        <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{filteredUsers.filter(u => u.is_active).length}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Active</p>
                    </div>
                    <div className="glass-card p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10">
                        <p className="text-3xl font-black text-rose-600 dark:text-rose-400">{filteredUsers.filter(u => !u.is_active).length}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Inactive</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <input
                        type="text"
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
                        <div className="flex items-center justify-center h-40 text-slate-400">
                            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
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
                                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 transition"
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
            </main>
        </div>
    );
}

export default UserManagement;
