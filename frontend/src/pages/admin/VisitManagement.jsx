import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { visitApi } from '../../api/visitApi';
import { AdminSidebar } from './HospitalAdminDashboard';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';
import './VisitManagement.css';

function VisitManagement() {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'pending');
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [nurses, setNurses] = useState([]);
    const [approvalData, setApprovalData] = useState({ doctorId: '', nurseId: '' });

    const [successModal, setSuccessModal] = useState({ show: false, title: '', message: '', highlight: '' });

    const loadVisits = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const statusFilter = activeTab === 'pending' ? 'pending' :
                activeTab === 'active' ? null :
                    activeTab;

            const response = await visitApi.getHospitalVisits(statusFilter);
            let filteredVisits = response.data || [];

            if (activeTab === 'active') {
                filteredVisits = filteredVisits.filter(v =>
                    ['approved', 'checked_in', 'in_progress'].includes(v.status)
                );
            } else if (activeTab === 'completed') {
                filteredVisits = filteredVisits.filter(v =>
                    ['completed', 'cancelled'].includes(v.status)
                );
            }

            setVisits(filteredVisits);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Failed to load visits';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadVisits();
    }, [loadVisits]);

    const handleApproveClick = async (visit) => {
        setSelectedVisit(visit);
        setShowApprovalModal(true);

        try {
            const [doctorsResponse, nursesResponse] = await Promise.all([
                visitApi.getStaffByRole('doctor'),
                visitApi.getStaffByRole('nurse')
            ]);
            setDoctors(doctorsResponse.data || []);
            setNurses(nursesResponse.data || []);
        } catch (err) {
            setDoctors([]);
            setNurses([]);
        }
    };

    const handleApproveVisit = async () => {
        try {
            const response = await visitApi.approveVisit(
                selectedVisit.id,
                approvalData.doctorId || selectedVisit.assigned_doctor_id || selectedVisit.doctor_id || null, // Pass selected or existing doctor
                approvalData.nurseId || null
            );
            // Close modal and show success with code
            setShowApprovalModal(false);
            const approvedCode = response.data?.otp_code || response.data?.otp;
            if (approvedCode) {
                setSuccessModal({
                    show: true,
                    title: 'Protocol Approved',
                    message: response.message || 'Visit approved. Share this code with the patient.',
                    highlight: approvedCode
                });
            } else {
                setSuccessModal({
                    show: true,
                    title: 'Protocol Approved',
                    message: 'Visit has been approved and assigned successfully!',
                    highlight: ''
                });
            }

            setApprovalData({ doctorId: '', nurseId: '' });
            setActiveTab('active'); // Switch to active tab
            loadVisits();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to approve visit');
        }
    };

    const handleCloseVisit = async (visitId, status) => {
        try {
            await visitApi.closeVisit(visitId, status);
            // Show success message so user knows it worked
            setSuccessModal({
                show: true,
                title: status === 'cancelled' ? 'Protocol Aborted' : 'Protocol Completed',
                message: `The visit protocol was successfully ${status}.`,
                highlight: ''
            });
            loadVisits();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to close visit');
        }
    };

    const getStatusBadge = (status) => {
        const statusColors = {
            pending: 'status-pending',
            approved: 'status-approved',
            checked_in: 'status-checked-in',
            in_progress: 'status-in-progress',
            completed: 'status-completed',
            cancelled: 'status-cancelled'
        };
        return <span className={`status-badge ${statusColors[status]}`}>{status.replace('_', ' ')}</span>;
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;

        if (diffMins < 1) return 'Just now';

        const hoursText = diffHours > 0 ? `${diffHours} hr${diffHours > 1 ? 's' : ''}` : '';
        const minsText = remMins > 0 ? `${remMins} min${remMins > 1 ? 's' : ''}` : '';
        const timeAgo = [hoursText, minsText].filter(Boolean).join(' ') + ' ago';

        return timeAgo || 'Just now';
    };

    return (
        <div className="admin-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50"><ThemeToggle /></div>
            <AdminSidebar active="/admin/visits" />

            <main className="flex-grow p-4 md:p-8 overflow-y-auto h-full relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Visit Management</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage patient visit requests and assignments</p>
                    </div>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-all text-sm font-bold shadow-sm group"
                    >
                        <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        Back to Dashboard
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 p-1 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-700/50 w-fit">
                    {[
                        { id: 'pending', label: 'Queued Request', icon: 'pending_actions' },
                        { id: 'active', label: 'Active Sessions', icon: 'stethoscope' },
                        { id: 'completed', label: 'Archived Logs', icon: 'history' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-4 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium flex items-center gap-3">
                        <span className="material-symbols-outlined">error</span>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                        <span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span>
                        <p className="text-sm font-bold uppercase tracking-widest">Synchronizing Logs...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {visits.length > 0 ? (
                            visits.map(visit => (
                                <div key={visit.id} className="admin-glass-card rounded-3xl p-6 flex flex-col group hover:border-indigo-500/30 transition-all border border-transparent">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                <span className="material-symbols-outlined text-xl">person</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white leading-none">
                                                    {visit.patient_first_name} {visit.patient_last_name}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-bold">Patient Protocol</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {getStatusBadge(visit.status)}
                                            <p className="text-[9px] text-slate-400 mt-2 font-mono">{formatDate(visit.created_at)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                                        <div>
                                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-1">Reason for Visit</p>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{visit.reason}</p>
                                        </div>
                                        {visit.doctor_first_name && (
                                            <div>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-1">Assigned Physician</p>
                                                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 italic">Dr. {visit.doctor_first_name} {visit.doctor_last_name}</p>
                                            </div>
                                        )}
                                    </div>

                                    {visit.symptoms && (
                                        <div className="mb-6 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50">
                                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mb-1">Reported Symptoms</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">"{visit.symptoms}"</p>
                                        </div>
                                    )}

                                    <div className="mt-auto flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                                        {visit.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => handleApproveClick(visit)}
                                                    className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/10"
                                                >
                                                    Approve Protocol
                                                </button>
                                                <button
                                                    onClick={() => handleCloseVisit(visit.id, 'cancelled')}
                                                    className="px-6 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 hover:border-rose-200 transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {['checked_in', 'in_progress'].includes(visit.status) && (
                                            <button
                                                onClick={() => handleCloseVisit(visit.id, 'completed')}
                                                className="flex-grow bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10"
                                            >
                                                Complete Clinical Session
                                            </button>
                                        )}
                                        {visit.status === 'approved' && (
                                            <div className="flex-grow p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px]">info</span>
                                                    Awaiting Patient Check-in
                                                </p>
                                            </div>
                                        )}
                                        {['approved', 'checked_in', 'in_progress'].includes(visit.status) && (
                                            <button
                                                onClick={() => handleCloseVisit(visit.id, 'cancelled')}
                                                className="px-6 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 hover:border-rose-200 transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-200/50 dark:border-slate-800/50 rounded-[3rem] bg-white/20 dark:bg-slate-900/20 backdrop-blur-sm group">
                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                                    <span className="material-symbols-outlined text-4xl opacity-50">event_busy</span>
                                </div>
                                <h4 className="text-xl font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] opacity-80">Silent Corridor</h4>
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-2 lowercase italic opacity-60">No pharmaceutical or clinical sessions currently queued.</p>
                            </div>
                        )}
                    </div>
                )}

                {showApprovalModal && (
                    <div className="modal-overlay" onClick={() => setShowApprovalModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Approve Visit Request</h2>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedVisit?.patient_first_name} {selectedVisit?.patient_last_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedVisit?.reason}</p>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Assign Medical Lead</label>
                                    <select
                                        value={approvalData.doctorId || selectedVisit?.assigned_doctor_id || selectedVisit?.doctor_id || ''}
                                        onChange={(e) => setApprovalData({ ...approvalData, doctorId: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        required
                                    >
                                        <option value="">Select a doctor</option>
                                        {doctors.map(doctor => (
                                            <option key={doctor.id} value={doctor.id}>
                                                Dr. {doctor.name || `${doctor.first_name || doctor.firstName} ${doctor.last_name || doctor.lastName} `}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Assign Nurse Specialist (Optional)</label>
                                    <select
                                        value={approvalData.nurseId}
                                        onChange={(e) => setApprovalData({ ...approvalData, nurseId: e.target.value })}
                                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    >
                                        <option value="">Select a nurse</option>
                                        {nurses.map(nurse => (
                                            <option key={nurse.id} value={nurse.id}>{nurse.name || `${nurse.firstName} ${nurse.lastName} `}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
                                    <span className="material-symbols-outlined text-indigo-500 mt-0.5">info</span>
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium">
                                        Approving this protocol will generate a secure visit code and notify the patient via encrypted communication channels.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setShowApprovalModal(false)}
                                    className="px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700"
                                >
                                    Abort
                                </button>
                                <button
                                    onClick={handleApproveVisit}
                                    className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                                >
                                    Authorize Approval
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {successModal.show && (
                    <div className="modal-overlay" onClick={() => setSuccessModal({ show: false, title: '', message: '', highlight: '' })}>
                        <div className="modal-content text-center py-8" onClick={(e) => e.stopPropagation()}>
                            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-3xl text-emerald-600 dark:text-emerald-400">check_circle</span>
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{successModal.title}</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6 max-w-[280px] mx-auto leading-relaxed">
                                {successModal.message}
                            </p>

                            {successModal.highlight && (
                                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 mb-8 inline-block shadow-inner">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Secure Visit Code</p>
                                    <p className="text-4xl font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-widest">
                                        {successModal.highlight}
                                    </p>
                                </div>
                            )}

                            <div>
                                <button
                                    onClick={() => setSuccessModal({ show: false, title: '', message: '', highlight: '' })}
                                    className="px-8 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default VisitManagement;
