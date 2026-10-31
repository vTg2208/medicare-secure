// VisitCard Component - Display individual visit information
import React from 'react';
import './VisitCard.css';

function VisitCard({ visit, onAction, showActions = true, userRole = 'patient' }) {
    const getStatusBadgeClass = (status) => {
        const normalized = status?.toLowerCase();

        const statusMap = {
            pending: 'status-scheduled',
            approved: 'status-scheduled',
            checked_in: 'status-checked-in',
            in_progress: 'status-active',
            completed: 'status-completed',
            cancelled: 'status-completed',
        };

        return statusMap[normalized] || 'status-scheduled';
    };

    const getProp = (obj, camel, snake) => obj && (obj[camel] || obj[snake]);

    const getVisitDate = () => {
        const dateStr = getProp(visit, 'scheduledTime', 'scheduled_time') ||
            getProp(visit, 'checkInTime', 'check_in_time') ||
            getProp(visit, 'createdAt', 'created_at');
        return dateStr ? new Date(dateStr) : new Date();
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const visitDate = getVisitDate();

    const visitType = getProp(visit, 'visitType', 'type');

    return (
        <div className="bg-surface dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md hover:border-primary-200 dark:hover:border-primary-400 transition-all p-5 mb-4">
            <div className="visit-card-header flex justify-between items-start mb-4">
                <div className="visit-info">
                    <h3 className="visit-doctor font-bold text-gray-900 dark:text-white text-lg m-0">
                        {userRole === 'patient'
                            ? (
                                visit.doctorName && visit.doctorName !== 'Unassigned'
                                    ? `Dr. ${visit.doctorName}`
                                    : (visit.doctor_first_name
                                        ? `Dr. ${visit.doctor_first_name} ${visit.doctor_last_name}`
                                        : 'Pending Assignment')
                            )
                            : (
                                visit.patientName
                                || (visit.patient_first_name
                                    ? `${visit.patient_first_name} ${visit.patient_last_name}`
                                    : 'Unknown Patient')
                            )
                        }
                    </h3>
                    <p className="visit-specialization text-sm text-gray-500 dark:text-gray-400 mt-1 m-0">{visit.specialization || 'General Consultation'}</p>
                </div>
                <span className={`visit-status-badge ${getStatusBadgeClass(visit.status)}`}>
                    {visit.status}
                </span>
            </div>

            <div className="visit-details grid grid-cols-2 gap-4 my-4 mb-5 pt-4 border-t border-gray-100 dark:border-slate-700">
                <div className="vc-detail-row flex flex-col">
                    <span className="vc-detail-label text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold mb-1">Date</span>
                    <span className="vc-detail-value text-sm font-medium text-gray-800 dark:text-gray-200">{formatDate(visitDate)}</span>
                </div>
                <div className="vc-detail-row flex flex-col">
                    <span className="vc-detail-label text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold mb-1">Time</span>
                    <span className="vc-detail-value text-sm font-medium text-gray-800 dark:text-gray-200">{formatTime(visitDate)}</span>
                </div>
                {visit.type === 'walk_in' && (
                    <div className="vc-detail-row flex flex-col">
                        <span className="vc-detail-label text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold mb-1">Created</span>
                        <span className="vc-detail-value text-sm font-medium text-gray-800 dark:text-gray-200">
                            {(() => {
                                const date = new Date(visit.created_at || visit.createdAt);
                                const now = new Date();
                                const diffMins = Math.floor((now - date) / 60000);
                                const diffHours = Math.floor(diffMins / 60);
                                const remMins = diffMins % 60;
                                const hText = diffHours > 0 ? `${diffHours} hr${diffHours > 1 ? 's' : ''}` : '';
                                const mText = remMins > 0 ? `${remMins} min${remMins > 1 ? 's' : ''}` : '';
                                return [hText, mText].filter(Boolean).join(' ') + ' ago';
                            })()}
                        </span>
                    </div>
                )}

                {visitType && (
                    <div className="vc-detail-row flex flex-col">
                        <span className="vc-detail-label text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold mb-1">Type</span>
                        <span className="vc-detail-value text-sm font-medium text-gray-800 dark:text-gray-200">{visitType}</span>
                    </div>
                )}
            </div>

            {showActions && onAction && (
                <div className="visit-card-actions">
                    {userRole === 'staff' && visit.status?.toLowerCase() === 'checked_in' && (
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onAction('activate', visit.id)}
                        >
                            Activate Visit
                        </button>
                    )}

                    {userRole === 'doctor' && visit.status?.toLowerCase() === 'in_progress' && (
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onAction('view', visit.id)}
                        >
                            View Details
                        </button>
                    )}

                    {(userRole === 'staff' || userRole === 'doctor') &&
                        visit.status?.toLowerCase() === 'in_progress' && (
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onAction('close', visit.id)}
                            >
                                Close Visit
                            </button>
                        )}
                </div>
            )}
        </div>
    );
}

export default VisitCard;
