import React from 'react';
import './VisitLifecycle.css';

function VisitLifecycle({ currentStatus, timestamps = {} }) {
    const stages = [
        {
            key: 'SCHEDULED',
            label: 'Scheduled',
            icon: '📅',
            description: 'Appointment booked'
        },
        {
            key: 'CHECKED_IN',
            label: 'Checked In',
            icon: '✅',
            description: 'Patient arrived'
        },
        {
            key: 'ACTIVE',
            label: 'Active',
            icon: '⚕️',
            description: 'Consultation in progress'
        },
        {
            key: 'COMPLETED',
            label: 'Completed',
            icon: '🎯',
            description: 'Visit concluded'
        },
    ];

    const getCurrentStageIndex = () => {
        return stages.findIndex(stage => stage.key === currentStatus);
    };

    const isStageComplete = (index) => {
        return index < getCurrentStageIndex();
    };

    const isStageCurrent = (index) => {
        return index === getCurrentStageIndex();
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return null;
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="visit-lifecycle">
            <div className="lifecycle-header">
                <h4>Visit Progress</h4>
                <span className="current-stage-badge">{currentStatus}</span>
            </div>

            <div className="lifecycle-timeline">
                {stages.map((stage, index) => (
                    <div
                        key={stage.key}
                        className={`timeline-stage ${isStageComplete(index) ? 'completed' : ''
                            } ${isStageCurrent(index) ? 'current' : ''
                            }`}
                    >
                        <div className="stage-connector-wrapper">
                            {index > 0 && (
                                <div className={`stage-connector ${isStageComplete(index) ? 'completed' : ''
                                    }`} />
                            )}
                        </div>

                        <div className="stage-marker">
                            <div className="stage-icon">
                                {isStageComplete(index) ? '✓' : stage.icon}
                            </div>
                        </div>

                        <div className="stage-content">
                            <h5 className="stage-label">{stage.label}</h5>
                            <p className="stage-description">{stage.description}</p>
                            {timestamps[stage.key] && (
                                <span className="stage-timestamp">
                                    {formatTimestamp(timestamps[stage.key])}
                                </span>
                            )}
                            {isStageCurrent(index) && (
                                <span className="stage-current-indicator">
                                    In Progress
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default VisitLifecycle;
