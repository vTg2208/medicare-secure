import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import './ConsentRequests.css';

function ConsentRequests() {
    const navigate = useNavigate();

    return (
        <div className="cr-wrapper">
            {/* Theme toggle */}
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 50 }}>
                <ThemeToggle />
            </div>

            {/* Top bar */}
            <div className="cr-topbar">
                <div className="cr-topbar-left">
                    <div className="cr-topbar-icon">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="cr-topbar-title">Consent Requests</h1>
                        <p className="cr-topbar-subtitle">Review and manage patient data access consent requests</p>
                    </div>
                </div>
                <button className="cr-btn-back" onClick={() => navigate('/doctor/dashboard')}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>
            </div>

            {/* Body */}
            <div className="cr-body">

                {/* Info banner */}
                <div className="cr-info-banner">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>Consent requests grant you access to patient medical data for the period specified by the patient.</span>
                </div>

                {/* Empty state */}
                <div className="cr-empty-state cr-glass">
                    <div className="cr-empty-icon">
                        <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                    </div>
                    <h3>No Consent Requests Pending</h3>
                    <p>Patient consent requests will appear here once patients grant you access to their medical data.</p>
                    <button className="cr-btn-secondary" onClick={() => navigate('/doctor/patients')}>
                        View Patients with Access
                    </button>
                </div>

            </div>
        </div>
    );
}

export default ConsentRequests;
