import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffApi } from '../../api/staffApi';
import { AdminSidebar } from './HospitalAdminDashboard';
import ThemeToggle from '../../components/common/ThemeToggle';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import '../patient/Dashboard.css';
import './StaffManagement.css';

const STATUS_COLORS = {
    PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    EXPIRED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

function StaffManagement() {
    const navigate = useNavigate();
    const [invitations, setInvitations] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [formData, setFormData] = useState({ email: '', role: 'NURSE', organizationId: '' });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [invitationsRes, statsRes] = await Promise.all([
                staffApi.getInvitations(),
                staffApi.getInvitationStats()
            ]);
            if (invitationsRes.success) setInvitations(invitationsRes.data || []);
            if (statsRes && statsRes.success) setStats(statsRes.data);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
        if (e.target.name === 'email') setEmailError('');
    };

    const handleEmailBlur = async () => {
        if (!formData.email) {
            setEmailError('');
            return;
        }

        // Email validity check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setEmailError('Please enter a valid email address.');
            return;
        }

        setCheckingEmail(true);
        setEmailError('');
        try {
            const res = await staffApi.checkEmail(formData.email);
            if (res.success && res.exists) {
                setEmailError(res.message || 'This email is already registered or invited.');
            }
        } catch (err) {
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault(); setError(''); setSubmitting(true);

        // Final email validity check before submit
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setEmailError('Please enter a valid email address.');
            setSubmitting(false);
            return;
        }

        if (emailError) {
            setSubmitting(false);
            return;
        }

        try {
            const response = await staffApi.inviteStaff(formData);
            if (response.success) { setShowInviteForm(false); setFormData({ email: '', role: 'NURSE', organizationId: '' }); loadData(); }
        } catch (err) { setError(err.response?.data?.message || 'Failed to send invitation'); }
        finally { setSubmitting(false); }
    };

    const handleResend = async (invitationId) => {
        try { const response = await staffApi.resendInvitation(invitationId); if (response.success) alert('Invitation resent successfully!'); }
        catch (err) { alert(err.response?.data?.message || 'Failed to resend invitation'); }
    };

    const handleCancel = async (invitationId) => {
        try { const response = await staffApi.cancelInvitation(invitationId); if (response.success) loadData(); }
        catch (err) { alert(err.response?.data?.message || 'Failed to cancel invitation'); }
    };

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme"><ThemeToggle /></div>
            <AdminSidebar active="/admin/staff" />

            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Staff Management</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Invite and manage staff members across the organisation</p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-surface dark:hover:bg-slate-800 transition-all text-sm font-bold shadow-sm group"
                    >
                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        Back to Dashboard
                    </button>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="glass-card p-5 rounded-2xl border border-primary-100 dark:border-primary-900/30 bg-primary-50/50 dark:bg-primary-900/10">
                            <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{stats.total || 0}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Total Invitations</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
                            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pending || 0}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Pending</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.accepted || 0}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Accepted</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                            <p className="text-3xl font-bold text-slate-600 dark:text-slate-400">{stats.expired || 0}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Expired</p>
                        </div>
                    </div>
                )}

                {/* Invite Button */}
                <div className="mb-6">
                    <Button onClick={() => setShowInviteForm(!showInviteForm)}>
                        {showInviteForm ? '✕ Cancel' : '+ Invite Staff Member'}
                    </Button>
                </div>

                {/* Invite Form */}
                {showInviteForm && (
                    <div className="glass-card rounded-3xl p-6 mb-6 border border-slate-200 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Send Staff Invitation</h3>
                        <form onSubmit={handleInviteSubmit} className="invite-form space-y-4 max-w-lg">
                            <div>
                                <Input label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleEmailBlur} required />
                                {checkingEmail && <p className="text-xs text-primary-500 mt-1">Verifying email...</p>}
                                {emailError && <p className="text-xs text-rose-500 mt-1 font-semibold">{emailError}</p>}
                            </div>
                            <div className="form-group">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                                <select name="role" value={formData.role} onChange={handleChange} className="form-select w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-slate-800 dark:text-white" required>
                                    <option value="NURSE">Nurse</option>
                                    <option value="LAB_TECHNICIAN">Lab Technician</option>
                                    <option value="RADIOLOGIST">Radiologist</option>
                                    <option value="PHARMACIST">Pharmacist</option>
                                    <option value="RECEPTIONIST">Receptionist</option>
                                    <option value="HOSPITAL_ADMIN">Admin</option>
                                </select>
                            </div>
                            <Input label="Organization ID (Optional)" type="text" name="organizationId" value={formData.organizationId} onChange={handleChange} placeholder="Leave blank for default organization" />
                            {error && <div className="text-rose-500 text-sm bg-rose-50 dark:bg-rose-900/20 px-4 py-2 rounded-xl">{error}</div>}
                            <Button type="submit" loading={submitting}>Send Invitation</Button>
                        </form>
                    </div>
                )}

                {/* Invitations Table */}
                <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-900 dark:text-white">Staff Invitations</h3>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400">
                            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                        </div>
                    ) : invitations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                            <span className="material-symbols-outlined text-4xl">mail</span>
                            <p className="text-sm">No invitations found. Click "Invite Staff Member" to get started.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Email</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Role</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Sent</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Expires</th>
                                        <th className="text-right px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {invitations.map(inv => (
                                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{inv.email}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{inv.role}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[inv.status?.toUpperCase()] || 'bg-slate-100 text-slate-600'}`}>{inv.status}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : 'N/A'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {(['PENDING', 'EXPIRED', 'CANCELLED'].includes(inv.status?.toUpperCase())) && (
                                                        <button onClick={() => handleResend(inv.id)} className="p-2 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition" title="Resend">
                                                            <span className="material-symbols-outlined text-[18px]">refresh</span>
                                                        </button>
                                                    )}
                                                    {inv.status?.toUpperCase() === 'PENDING' && (
                                                        <button onClick={() => handleCancel(inv.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition" title="Cancel">
                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                        </button>
                                                    )}
                                                </div>
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

export default StaffManagement;
