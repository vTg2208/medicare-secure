import Pagination from '../../components/common/Pagination';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import usePagedResults from '../../hooks/usePagedResults';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { visitApi } from '../../api/visitApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import './ActiveVisits.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const getProp = (obj, camel, snake) => obj && (obj[camel] || obj[snake]);

const getVisitDate = (visit) => {
    const ds = getProp(visit, 'scheduledTime', 'scheduled_time')
        || getProp(visit, 'checkInTime', 'check_in_time')
        || getProp(visit, 'createdAt', 'created_at');
    return ds ? new Date(ds) : new Date();
};

const fmt = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const getWaitTime = (visit) => {
    if (visit.type !== 'walk_in' && visit.visit_type !== 'walk_in') return null;
    const date = new Date(visit.created_at || visit.createdAt);
    const diffMins = Math.floor((new Date() - date) / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : ''].filter(Boolean).join(' ') + ' ago';
};

const getPatientInitials = (visit) => {
    const fn = visit.patient_first_name || visit.patientName?.split(' ')[0] || '';
    const ln = visit.patient_last_name || visit.patientName?.split(' ')[1] || '';
    return (fn[0] || '?') + (ln[0] || '');
};

const getPatientName = (visit) =>
    visit.patientName
    || (visit.patient_first_name
        ? `${visit.patient_first_name} ${visit.patient_last_name}`
        : 'Unknown Patient');

const badgeClass = (status) => {
    const s = status?.toLowerCase().replace(' ', '_');
    const map = {
        pending: 'aq-badge-pending',
        approved: 'aq-badge-approved',
        checked_in: 'aq-badge-checked_in',
        in_progress: 'aq-badge-in_progress',
        completed: 'aq-badge-completed',
        cancelled: 'aq-badge-cancelled',
    };
    return `aq-badge ${map[s] || 'aq-badge-approved'}`;
};

// ── Component ─────────────────────────────────────────────────────────────────
function ActiveVisits() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const search = useDebouncedValue(searchTerm.trim());
    const loadPage = useCallback((limit, offset) => visitApi.getActiveVisits({
        limit, offset, search: search || undefined, status: status || undefined
    }), [search, status]);
    const { rows: visits, loading, error, refresh, pagination } = usePagedResults(loadPage, 30000);

    const handleAction = async (action, visitId) => {
        try {
            if (action === 'view') {
                navigate(`/doctor/notes?visitId=${encodeURIComponent(visitId)}`);
            } else if (action === 'close') {
                if (!window.confirm('Are you sure you want to mark this visit as completed?')) return;
                await visitApi.closeVisit(visitId, 'completed');
                setSuccessMessage('Visit marked as completed!');
                refresh();
                setTimeout(() => setSuccessMessage(''), 3000);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Action failed');
        }
    };

    return (
        <div className="aq-wrapper">
            {/* Theme toggle */}


            {/* Top bar */}
            <div className="aq-topbar mc-page-topbar">
                <div className="aq-topbar-left">
                    <div className="aq-topbar-icon">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="aq-topbar-title">Consultation Queue</h1>
                        <p className="aq-topbar-subtitle">View scheduled appointments and manage consultation workflow</p>
                    </div>
                </div>
                <div className="aq-topbar-actions mc-page-actions">
                    <button
                        className={`aq-btn-refresh${loading ? "spinning" : ''}`}
                        onClick={refresh}
                    >
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <button className="aq-btn-back" onClick={() => navigate('/doctor/dashboard')}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Body */}
            <div className="aq-body">
                {/* Stats row */}
                <div className="aq-stats-row">
                    <div className="aq-stat-card">
                        <div className="aq-stat-number">{pagination.total}</div>
                        <div className="aq-stat-label">Matching Visits</div>
                    </div>
                    {visits.length > 0 && (
                        <div className="aq-stat-card" style={{ background: "var(--mc-brand)" }}>
                            <div className="aq-stat-number">
                                {visits.filter(v => v.status?.toLowerCase() === 'in_progress').length}
                            </div>
                            <div className="aq-stat-label">In Progress on This Page</div>
                        </div>
                    )}
                </div>

                {/* Success toast */}
                {successMessage && (
                    <div className="aq-toast">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {successMessage}
                    </div>
                )}

                <input type="search" aria-label="Search visits" placeholder="Search by patient name or visit code"
                    value={searchTerm} onChange={event => setSearchTerm(event.target.value)}
                    className="my-4 w-full max-w-md rounded-xl border border-line bg-surface px-4 py-2" />
                <select aria-label="Visit status" value={status} onChange={event => setStatus(event.target.value)}
                    className="ml-2 rounded-xl border border-line bg-surface px-4 py-2">
                    <option value="">All queue statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="checked_in">Checked in</option>
                    <option value="in_progress">In progress</option>
                </select>

                {/* Content */}
                {loading ? (
                    <div className="aq-loading">
                        <LoadingSkeleton label="Loading active visits" rows={3} />
                        <p>Loading active visits…</p>
                    </div>
                ) : error ? (
                    <div role="alert" className="aq-empty-state aq-glass">{error} <button type="button" onClick={refresh}>Retry</button></div>
                ) : visits.length === 0 ? (
                    <div className="aq-empty-state aq-glass">
                        <svg width="52" height="52" fill="none" stroke="var(--mc-accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3>No Active Visits</h3>
                        <p>Active patient visits will appear here for consultation</p>
                    </div>
                ) : (
                    <>
                        <h2 className="aq-section-heading">Active Visits</h2>
                        <div className="aq-visit-list">
                            {visits.map(visit => {
                                const vDate = getVisitDate(visit);
                                const waitTime = getWaitTime(visit);
                                const visitType = getProp(visit, 'visitType', 'type');
                                const initials = getPatientInitials(visit);
                                const name = getPatientName(visit);

                                return (
                                    <div key={visit.id} className="aq-visit-card aq-glass">
                                        {/* Header */}
                                        <div className="aq-visit-header">
                                            <div className="aq-visit-patient">
                                                <div className="aq-patient-avatar">{initials}</div>
                                                <div>
                                                    <p className="aq-patient-name">{name}</p>
                                                    <p className="aq-patient-spec">{visit.specialization || 'General Consultation'}</p>
                                                </div>
                                            </div>
                                            <span className={badgeClass(visit.status)}>
                                                {visit.status?.replace('_', ' ')}
                                            </span>
                                        </div>

                                        {/* Details */}
                                        <div className="aq-visit-details">
                                            <div>
                                                <span className="aq-detail-label">Date</span>
                                                <span className="aq-detail-value">{fmt(vDate)}</span>
                                            </div>
                                            <div>
                                                <span className="aq-detail-label">Time</span>
                                                <span className="aq-detail-value">{fmtTime(vDate)}</span>
                                            </div>
                                            {visitType && (
                                                <div>
                                                    <span className="aq-detail-label">Type</span>
                                                    <span className="aq-detail-value">{visitType}</span>
                                                </div>
                                            )}
                                            {waitTime && (
                                                <div>
                                                    <span className="aq-detail-label">Waiting</span>
                                                    <span className="aq-detail-value">{waitTime}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="aq-visit-actions">
                                            {visit.status?.toLowerCase() === 'in_progress' && (
                                                <button
                                                    className="aq-action-btn aq-action-btn-primary"
                                                    onClick={() => handleAction('view', visit.id)}
                                                >
                                                    View Details
                                                </button>
                                            )}
                                            {visit.status?.toLowerCase() === 'in_progress' && (
                                                <button
                                                    className="aq-action-btn aq-action-btn-secondary"
                                                    onClick={() => handleAction('close', visit.id)}
                                                >
                                                    Close Visit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
                <Pagination {...pagination} />
            </div>
        </div>
    );
}

export default ActiveVisits;
