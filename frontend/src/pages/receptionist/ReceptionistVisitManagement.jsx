import Brand from '../../components/common/Brand';
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../patient/Dashboard.css';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { visitApi } from '../../api/visitApi';
import { AuthContext } from '../../context/AuthContext';

/* ─────────────────── helpers ─────────────────── */
const formatTimeAgo = (dateString) => {
    const d = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now - d) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    if (diffMins < 1) return 'Just now';
    const hrs = diffHours > 0 ? `${diffHours}h` : '';
    const mins = remMins > 0 ? `${remMins}m` : '';
    return `${hrs} ${mins} ago`.trim();
};

const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const STATUS_COLORS = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
    checked_in: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
    in_progress: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
    completed: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-300' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

const StatusBadge = ({ status }) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.bg}  ${c.text}`}>
            {status?.replace('_', ' ')}
        </span>
    );
};

/* ─────────────── Sortable Visit Card for Scheduling ─────────────── */
function SortableVisitCard({ visit }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: visit.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
        >
            <div {...attributes} {...listeners} className="text-slate-300 dark:text-slate-600 hover:text-slate-500 flex-shrink-0">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {visit.patient_first_name} {visit.patient_last_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{visit.reason}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                    Requested: {formatDateTime(visit.scheduled_time || visit.created_at)}
                </p>
            </div>
            <StatusBadge status={visit.status} />
        </div>
    );
}

/* ════════════════ TAB 1: Approve Scheduled Visits ════════════════ */
function ApproveVisitsTab() {
    const [activeSubTab, setActiveSubTab] = useState('pending');
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedVisit, setSelectedVisit] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [nurses, setNurses] = useState([]);
    const [approvalData, setApprovalData] = useState({ nurseId: '', doctorId: '' });

    const loadVisits = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await visitApi.getHospitalVisits(activeSubTab === 'pending' ? 'pending' : null);
            let data = response.data || [];
            if (activeSubTab === 'active') {
                data = data.filter(v => ['approved', 'checked_in', 'in_progress'].includes(v.status));
            } else if (activeSubTab === 'completed') {
                data = data.filter(v => ['completed', 'cancelled'].includes(v.status));
            }
            setVisits(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load visits');
        } finally {
            setLoading(false);
        }
    }, [activeSubTab]);

    useEffect(() => { loadVisits(); }, [loadVisits]);

    const handleApproveClick = async (visit) => {
        setSelectedVisit(visit);
        setApprovalData({ nurseId: '', doctorId: visit.assigned_doctor_id || '' });
        setShowApprovalModal(true);
        try {
            const [nursesRes, doctorsRes] = await Promise.all([
                visitApi.getStaffByRole('nurse'),
                visitApi.getStaffByRole('doctor')
            ]);
            setNurses(nursesRes.data || []);
            setDoctors(doctorsRes.data || []);
        } catch {
            setNurses([]);
            setDoctors([]);
        }
    };

    const handleApproveVisit = async () => {
        try {
            const response = await visitApi.approveVisit(
                selectedVisit.id,
                approvalData.doctorId || null,
                approvalData.nurseId || null
            );
            setShowApprovalModal(false);
            const code = response.data?.otp_code || response.data?.otp;
            if (code) alert(`✅ Visit Approved!\nVisit Code: ${code}\n\n${response.message || 'Share this code with the patient.'}`);
            else alert('✅ Visit Approved and assigned!');
            setApprovalData({ nurseId: '', doctorId: '' });
            setActiveSubTab('active');
            loadVisits();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve visit');
        }
    };

    const handleCloseVisit = async (visitId, status) => {
        if (!window.confirm(`Are you sure you want to ${status} this visit?`)) return;
        try {
            await visitApi.closeVisit(visitId, status);
            loadVisits();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update visit');
        }
    };

    return (
        <div>
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl mb-6 w-fit">
                {['pending', 'active', 'completed'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveSubTab(tab)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeSubTab === tab
                            ? 'bg-surface dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm mb-4">{error}</div>}
            {loading && <div className="text-slate-500 dark:text-slate-400 text-sm">Loading visits...</div>}

            {!loading && (
                <div className="space-y-3">
                    {visits.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                            <div className="text-5xl mb-3">📅</div>
                            <p className="font-medium">No {activeSubTab} visits</p>
                        </div>
                    ) : visits.map(visit => (
                        <div key={visit.id} className="bg-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <StatusBadge status={visit.status} />
                                    <span className="text-xs text-slate-400">{formatTimeAgo(visit.created_at)}</span>
                                </div>
                                {visit.scheduled_time && (
                                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-lg">
                                        🕐 {formatDateTime(visit.scheduled_time)}
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-4">
                                <div><span className="text-slate-400 text-xs uppercase font-semibold">Patient</span><p className="font-semibold text-slate-800 dark:text-slate-100">{visit.patient_first_name} {visit.patient_last_name}</p></div>
                                <div><span className="text-slate-400 text-xs uppercase font-semibold">Doctor</span><p className="font-semibold text-slate-800 dark:text-slate-100">{visit.doctor_first_name ? `Dr. ${visit.doctor_first_name} ${visit.doctor_last_name}` : '—'}</p></div>
                                <div className="col-span-2"><span className="text-slate-400 text-xs uppercase font-semibold">Reason</span><p className="text-slate-700 dark:text-slate-300">{visit.reason}</p></div>
                                {visit.symptoms && (
                                    <div className="col-span-2"><span className="text-slate-400 text-xs uppercase font-semibold">Symptoms</span><p className="text-slate-700 dark:text-slate-300">{visit.symptoms}</p></div>
                                )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {visit.status === 'pending' && (
                                    <>
                                        <button onClick={() => handleApproveClick(visit)} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors">Approve</button>
                                        <button onClick={() => handleCloseVisit(visit.id, 'cancelled')} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 text-sm font-semibold rounded-lg transition-colors">Reject</button>
                                    </>
                                )}
                                {['approved', 'checked_in', 'in_progress'].includes(visit.status) && (
                                    <>
                                        <button onClick={() => handleCloseVisit(visit.id, 'completed')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">Complete Visit</button>
                                        <button onClick={() => handleCloseVisit(visit.id, 'cancelled')} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 text-sm font-semibold rounded-lg transition-colors">Cancel</button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Approval Modal */}
            {showApprovalModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowApprovalModal(false)}>
                    <div className="bg-surface dark:bg-slate-900 rounded-2xl shadow-sm w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Approve Visit</h2>
                        <div className="space-y-3 mb-6">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Patient</p>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedVisit?.patient_first_name} {selectedVisit?.patient_last_name}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Assigned Doctor</p>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                    {selectedVisit?.doctor_first_name ? `Dr. ${selectedVisit.doctor_first_name} ${selectedVisit.doctor_last_name}` : '⚠️ No doctor assigned yet'}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Reason</p>
                                <p className="text-slate-700 dark:text-slate-300">{selectedVisit?.reason}</p>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Assign Doctor</label>
                                <select
                                    value={approvalData.doctorId}
                                    onChange={e => setApprovalData({ ...approvalData, doctorId: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none mb-3"
                                >
                                    <option value="">Select a doctor</option>
                                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name || `${d.first_name} ${d.last_name}`}</option>)}
                                </select>

                                <label className="text-xs text-slate-400 uppercase font-bold block mb-1">Assign Nurse (Optional)</label>
                                <select
                                    value={approvalData.nurseId}
                                    onChange={e => setApprovalData({ ...approvalData, nurseId: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
                                >
                                    <option value="">No nurse</option>
                                    {nurses.map(n => <option key={n.id} value={n.id}>{n.name || `${n.first_name} ${n.last_name}`}</option>)}
                                </select>
                            </div>
                            <p className="text-xs text-slate-400">The visit code is shown after approval. An email is sent when delivery is available.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowApprovalModal(false)} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={handleApproveVisit} className="flex-1 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">Approve visit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ════════════════ TAB 2: Walk-In QR Code ════════════════ */
function WalkInQRTab() {
    const walkInUrl = `${window.location.origin}/patient/visits/new`;
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(walkInUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col items-center max-w-lg mx-auto py-8">
            <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                <span className="text-2xl">🏥</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Walk-In QR Code</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 text-center">
                Display this QR code at the reception desk. Patients can scan it to access the walk-in check-in portal.
            </p>

            <div className="bg-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-sm mb-6 flex flex-col items-center">
                <QRCodeSVG
                    value={walkInUrl}
                    size={220}
                    level="H"
                    includeMargin={true}
                    fgColor="#1e293b"
                    bgColor="#ffffff"
                />
            </div>

            <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3 mb-4">
                <span className="text-slate-400 flex-shrink-0">🔗</span>
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1 font-mono">{walkInUrl}</span>
                <button
                    onClick={handleCopy}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50"}`}
                >
                    {copied ? '✓ Copied' : 'Copy'}
                </button>
            </div>

            <button
                onClick={() => window.print()}
                className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors"
            >
                🖨️ Print QR Code
            </button>

            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center">
                Patients will need a hospital-issued visit code to complete check-in via this QR code.
            </p>
        </div>
    );
}

/* ════════════════ TAB 3: Appointment Scheduling ════════════════ */
function AppointmentSchedulingTab() {
    const [, setVisits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedDoctors, setSavedDoctors] = useState({});
    // doctorGroups: { doctorId: { doctorName, visits: [...] } }
    const [doctorGroups, setDoctorGroups] = useState({});

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const loadVisits = async () => {
        setLoading(true);
        try {
            const response = await visitApi.getHospitalVisits(null);
            const allVisits = (response.data || []).filter(v =>
                ['pending', 'approved'].includes(v.status) && v.assigned_doctor_id
            );
            setVisits(allVisits);

            // Group by doctor
            const groups = {};
            allVisits.forEach(v => {
                const docId = v.assigned_doctor_id;
                if (!groups[docId]) {
                    groups[docId] = {
                        doctorName: `Dr. ${v.doctor_first_name || ''} ${v.doctor_last_name || ''}`.trim(),
                        visits: [],
                    };
                }
                groups[docId].visits.push(v);
            });

            // Sort each doctor's visits by earliest requested scheduled_time or created_at
            Object.keys(groups).forEach(docId => {
                groups[docId].visits.sort((a, b) => {
                    const timeA = new Date(a.scheduled_time || a.created_at);
                    const timeB = new Date(b.scheduled_time || b.created_at);
                    return timeA - timeB;
                });
            });

            setDoctorGroups(groups);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadVisits(); }, []);

    const handleDragEnd = (event, doctorId) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setDoctorGroups(prev => {
            const group = prev[doctorId];
            const oldIndex = group.visits.findIndex(v => v.id === active.id);
            const newIndex = group.visits.findIndex(v => v.id === over.id);
            return {
                ...prev,
                [doctorId]: { ...group, visits: arrayMove(group.visits, oldIndex, newIndex) }
            };
        });
    };

    const handleSaveSchedule = async (doctorId) => {
        setSaving(true);
        const group = doctorGroups[doctorId];
        const visitsToUpdate = group.visits;

        // Find the earliest requested time as the anchor
        const times = visitsToUpdate
            .map(v => v.scheduled_time || v.created_at)
            .filter(Boolean)
            .map(t => new Date(t));

        const anchorTime = times.length > 0 ? new Date(Math.min(...times)) : new Date();
        // Round up to next clean 30-min slot
        anchorTime.setSeconds(0, 0);
        if (anchorTime.getMinutes() % 30 !== 0) {
            anchorTime.setMinutes(anchorTime.getMinutes() < 30 ? 30 : 60, 0, 0);
        }

        try {
            for (let i = 0; i < visitsToUpdate.length; i++) {
                const slotTime = new Date(anchorTime.getTime() + i * 30 * 60 * 1000);
                await visitApi.updateScheduledTime(visitsToUpdate[i].id, slotTime.toISOString());
            }
            setSavedDoctors(prev => ({ ...prev, [doctorId]: true }));
            setTimeout(() => setSavedDoctors(prev => ({ ...prev, [doctorId]: false })), 2500);
            await loadVisits();
        } catch (err) {
            alert('Failed to save schedule: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-slate-500 dark:text-slate-400 text-sm py-8">Loading appointments...</div>;

    const doctorIds = Object.keys(doctorGroups);

    if (doctorIds.length === 0) {
        return (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                <div className="text-5xl mb-3">🗓️</div>
                <p className="font-medium">No appointments to schedule</p>
                <p className="text-sm mt-1">Pending or approved visits with an assigned doctor will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Drag and drop to reorder appointments for each doctor. Click <strong>Save Schedule</strong> to assign 30-minute incremental slots starting from the earliest requested time.
            </p>
            {doctorIds.map(docId => {
                const { doctorName, visits: docVisits } = doctorGroups[docId];
                return (
                    <div key={docId} className="bg-surface dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                    <span className="text-primary-600 dark:text-primary-400 text-sm font-bold">{doctorName.split(' ').filter(p => !['Dr.'].includes(p)).map(p => p[0]).join('').slice(0, 2)}</span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{doctorName}</p>
                                    <p className="text-xs text-slate-400">{docVisits.length} appointment{docVisits.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleSaveSchedule(docId)}
                                disabled={saving}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${savedDoctors[docId]
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : "bg-primary-600 hover:bg-primary-700 text-white"} disabled:opacity-50`}
                            >
                                {savedDoctors[docId] ? '✓ Saved' : saving ? 'Saving...' : 'Save Schedule'}
                            </button>
                        </div>

                        <div className="p-4 space-y-2">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(e) => handleDragEnd(e, docId)}
                            >
                                <SortableContext items={docVisits.map(v => v.id)} strategy={verticalListSortingStrategy}>
                                    {docVisits.map(visit => (
                                        <SortableVisitCard key={visit.id} visit={visit} />
                                    ))}
                                </SortableContext>
                            </DndContext>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ════════════════ Main Receptionist Page ════════════════ */
function ReceptionistVisitManagement() {
    const {  logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('approve');

    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (hash && ['approve', 'walkin', 'schedule'].includes(hash)) {
            setActiveTab(hash);
        }
    }, []);

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/staff/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <button onClick={() => navigate('/staff/dashboard')} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-lg">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Overview
                    </button>
                    <button onClick={() => setActiveTab('approve')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'approve' ? 'sidebar-item-active font-medium text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                        <span className="material-symbols-outlined text-[20px]">fact_check</span>
                        Approve Visits
                    </button>
                    <button onClick={() => setActiveTab('walkin')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'walkin' ? 'sidebar-item-active font-medium text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                        <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                        Walk-In QR Code
                    </button>
                    <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center justify-start gap-3 px-4 py-3 rounded-lg transition ${activeTab === 'schedule' ? 'sidebar-item-active font-medium text-slate-800 dark:text-slate-800' : 'text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface'}`}>
                        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                        Scheduling
                    </button>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <button onClick={logout} className="w-full flex items-center justify-start gap-3 px-4 py-3 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition rounded-lg font-medium">
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                <header className="mb-10">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Visit Management</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                Manage patient visits, generate walk-in QR codes, and schedule appointments
                            </p>
                        </div>
                        <div className="flex items-center gap-3 glass-card px-4 py-2 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Receptionist Active</span>
                        </div>
                    </div>
                </header>

                <div className="glass-card rounded-3xl p-6 min-h-[60vh]">
                    {activeTab === 'approve' && <ApproveVisitsTab />}
                    {activeTab === 'walkin' && <WalkInQRTab />}
                    {activeTab === 'schedule' && <AppointmentSchedulingTab />}
                </div>
            </main>
        </div>
    );
}

export default ReceptionistVisitManagement;
