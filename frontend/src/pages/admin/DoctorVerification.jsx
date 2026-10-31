import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api/doctorApi';
import { downloadFile } from '../../utils/downloadFile';
import { AdminSidebar } from './HospitalAdminDashboard';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';

function DoctorVerification() {
    const navigate = useNavigate();
    const [pendingDoctors, setPendingDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [notes, setNotes] = useState('');
    const [reason, setReason] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [documentError, setDocumentError] = useState('');
    const [documentLoading, setDocumentLoading] = useState(null);

    const handleDocumentDownload = async (document) => {
        setDocumentError('');
        setDocumentLoading(document.id);
        try {
            await downloadFile(`/api/doctors/verification/documents/${encodeURIComponent(document.id)}/download`, document.file_name || 'credential');
        } catch { setDocumentError('Unable to download this credential. Please retry.'); }
        finally { setDocumentLoading(null); }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [pendingRes, statsRes] = await Promise.all([
                doctorApi.getPendingVerifications(),
                doctorApi.getVerificationStats()
            ]);
            if (pendingRes.success) setPendingDoctors(pendingRes.data || []);
            if (statsRes.success) setStats(statsRes.data);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleApprove = async (userId) => {
        setActionLoading(userId);
        try {
            const res = await doctorApi.approveDoctor(userId, notes);
            if (res.success) { alert('Doctor approved successfully!'); setNotes(''); setSelectedDoctor(null); fetchData(); }
        } catch (error) { alert(error.response?.data?.message || 'Failed to approve doctor'); }
        finally { setActionLoading(null); }
    };

    const handleReject = async (userId) => {
        if (!reason) { alert('Please provide a rejection reason'); return; }
        setActionLoading(userId);
        try {
            const res = await doctorApi.rejectDoctor(userId, reason);
            if (res.success) { alert('Doctor rejected'); setReason(''); setSelectedDoctor(null); fetchData(); }
        } catch (error) { alert(error.response?.data?.message || 'Failed to reject doctor'); }
        finally { setActionLoading(null); }
    };

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme"><ThemeToggle /></div>
            <AdminSidebar active="/admin/doctor-verification" />

            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Doctor Verification</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review and approve healthcare professional credentials</p>
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
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="glass-card p-5 rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10">
                            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Pending Review</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10">
                            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.verified}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Verified Doctors</p>
                        </div>
                        <div className="glass-card p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10">
                            <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{stats.rejected}</p>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Rejected</p>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex gap-4">
                        <button
                            className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'pending' ? "border-primary-500 text-primary-600 dark:text-primary-400" : 'border-transparent text-slate-500 dark:text-slate-400'}`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Pending Verifications
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-40 text-slate-400">
                            <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                        </div>
                    ) : pendingDoctors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                            <span className="material-symbols-outlined text-4xl">verified_user</span>
                            <p className="text-sm">No pending verifications found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Doctor Name</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Email</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Registration Date</th>
                                        <th className="text-left px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Documents</th>
                                        <th className="text-right px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {pendingDoctors.map(doctor => (
                                        <tr key={doctor.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">Dr. {doctor.first_name} {doctor.last_name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{doctor.email}</td>
                                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{new Date(doctor.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                                    {doctor.document_count} Docs
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setSelectedDoctor(doctor)}
                                                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary-500 hover:bg-primary-600 text-white transition"
                                                >
                                                    Review Credentials
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Review Modal — unchanged logic, restyled */}
            {selectedDoctor && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="glass-card rounded-3xl p-8 w-full max-w-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Review Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}
                            </h2>
                            <button onClick={() => setSelectedDoctor(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            The doctor has uploaded <strong>{selectedDoctor.document_count}</strong> document(s) for verification.
                        </p>
                        {documentError && <p role="alert" className="mb-4 text-rose-600">{documentError}</p>}
                        <ul className="mb-6 space-y-2">
                            {(selectedDoctor.documents || []).map(document => <li key={document.id}>
                                <button type="button" disabled={documentLoading === document.id}
                                    className="text-primary-600 underline disabled:opacity-50"
                                    onClick={() => handleDocumentDownload(document)}>
                                    Download {document.document_type || 'credential'}: {document.file_name}
                                </button>
                            </li>)}
                        </ul>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Approve */}
                            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                                <h4 className="font-bold text-emerald-700 dark:text-emerald-300 mb-3">✓ Approve Account</h4>
                                <textarea
                                    className="w-full px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-surface dark:bg-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 dark:text-white"
                                    placeholder="Approval notes (optional)" rows={3}
                                    value={notes} onChange={(e) => setNotes(e.target.value)}
                                />
                                <button
                                    onClick={() => handleApprove(selectedDoctor.id)}
                                    disabled={actionLoading === selectedDoctor.id}
                                    className="mt-3 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition disabled:opacity-50"
                                >
                                    {actionLoading === selectedDoctor.id ? 'Approving...' : 'Approve Doctor'}
                                </button>
                            </div>

                            {/* Reject */}
                            <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30">
                                <h4 className="font-bold text-rose-700 dark:text-rose-300 mb-3">✕ Reject Account</h4>
                                <textarea
                                    className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-surface dark:bg-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-400 dark:text-white"
                                    placeholder="Reason for rejection (required)" rows={3} required
                                    value={reason} onChange={(e) => setReason(e.target.value)}
                                />
                                <button
                                    onClick={() => handleReject(selectedDoctor.id)}
                                    disabled={actionLoading === selectedDoctor.id}
                                    className="mt-3 w-full py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition disabled:opacity-50"
                                >
                                    {actionLoading === selectedDoctor.id ? 'Rejecting...' : 'Reject Doctor'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DoctorVerification;
