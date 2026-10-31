import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import AddMedicalRecordForm from '../../components/emr/AddMedicalRecordForm';
import OrderTestsModal from '../../components/clinical/OrderTestsModal';
import ThemeToggle from '../../components/common/ThemeToggle';
import './PatientRecords.css';

function PatientMedicalRecords() {
    const { id: patientId } = useParams();
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [patientInfo, setPatientInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [expandedRecords, setExpandedRecords] = useState(new Set());
    const [hasWriteAccess, setHasWriteAccess] = useState(false);
    const [hasReadAccess, setHasReadAccess] = useState(false);
    const [orderModalTab, setOrderModalTab] = useState(null);

    const checkConsentAccess = useCallback(async () => {
        try {
            const response = await apiClient.get('/consent/doctor/patients');
            if (response.data.success) {
                const patients = response.data.data || [];
                const patientConsents = patients.filter(p => p.id === patientId);
                const medicalConsent = patientConsents.find(p =>
                    p.data_category === 'medical_records' ||
                    p.data_category === 'all_medical_data' ||
                    p.data_category === '*'
                );
                if (medicalConsent) {
                    setHasReadAccess(true);
                    setHasWriteAccess(medicalConsent.access_level === 'write');
                } else {
                    setHasReadAccess(false);
                    setHasWriteAccess(false);
                }
            }
        } catch (err) {
            setHasWriteAccess(false);
            setHasReadAccess(false);
        }
    }, [patientId]);

    const fetchPatientRecords = useCallback(async () => {
        try {
            const response = await apiClient.get(`/emr/patients/${patientId}/medical-records`);
            if (response.data.success) {
                const recordsData = response.data.data.records || [];
                setRecords(recordsData);
                if (recordsData.length > 0) {
                    setPatientInfo({
                        name: `${recordsData[0].patient_first_name || ''} ${recordsData[0].patient_last_name || ''}`.trim(),
                        healthId: recordsData[0].patient_health_id,
                        firstName: recordsData[0].patient_first_name,
                    });
                }
            }
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load medical records.');
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchPatientRecords();
        checkConsentAccess();
    }, [fetchPatientRecords, checkConsentAccess]);

    const formatDate = (ds) => {
        if (!ds) return 'N/A';
        return new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatRecordType = (type) => ({
        consultation: 'Consultation', diagnosis: 'Diagnosis', prescription: 'Prescription',
        lab_result: 'Lab Result', imaging: 'Imaging Report', procedure: 'Procedure',
        note: 'Clinical Note', other: 'Other'
    }[type] || type);

    const toggleExpand = (id) => {
        setExpandedRecords(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    return (
        <div className="pr-wrapper">
            {/* Theme Toggle */}


            {/* Top Bar */}
            <div className="pr-topbar mc-page-topbar">
                <div className="pr-topbar-left">
                    <div className="pr-topbar-icon">
                        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>medical_information</span>
                    </div>
                    <div>
                        <h1 className="pr-topbar-title">Medical Records</h1>
                        {patientInfo && (
                            <p className="pr-topbar-subtitle">
                                {patientInfo.name} &nbsp;·&nbsp; Health ID: {patientInfo.healthId}
                            </p>
                        )}
                    </div>
                </div>
                <div className="pr-topbar-actions mc-page-actions">
                    {hasWriteAccess && !loading && !error && (
                        <button
                            className="pr-btn-primary"
                            onClick={() => setShowAddForm(v => !v)}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                {showAddForm ? 'close' : 'add'}
                            </span>
                            {showAddForm ? 'Cancel' : 'Add Record'}
                        </button>
                    )}
                    <button className="pr-btn-back" onClick={() => navigate('/doctor/patients')}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Patients
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            <div className="pr-body">

                {/* Patient Profile Card */}
                {patientInfo && !loading && (
                    <div className="pr-profile-card pr-glass-card">
                        <div className="pr-profile-avatar-row">
                            <div className="pr-avatar">
                                {(patientInfo.firstName || patientInfo.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="pr-profile-name">{patientInfo.name}</p>
                                <p className="pr-profile-meta">
                                    Health ID: {patientInfo.healthId}&nbsp;&nbsp;·&nbsp;&nbsp;Patient ID: {patientId}
                                </p>
                            </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="pr-quick-actions">
                            <button
                                className="pr-action-btn"
                                style={{ borderColor: "var(--mc-border)", color: "var(--mc-text)", background: "var(--mc-surface-muted)" }}
                                onClick={() => setShowAddForm(false)}
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                                View History
                            </button>
                            <button
                                className="pr-action-btn"
                                style={{ borderColor: "var(--mc-border)", color: "var(--mc-accent)", background: "var(--mc-brand-soft)" }}
                                onClick={() => navigate(`/doctor/notes?patientId=${patientId}`)}
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Clinical Notes
                            </button>
                            <button
                                className="pr-action-btn"
                                style={{ borderColor: "var(--mc-success-border)", color: "var(--mc-success)", background: "var(--mc-success-bg)" }}
                                onClick={() => setOrderModalTab('lab')}
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v11a3 3 0 006 0V3" /><line x1="6" y1="3" x2="18" y2="3" />
                                </svg>
                                Order Lab Test
                            </button>
                            <button
                                className="pr-action-btn"
                                style={{ borderColor: "var(--mc-border)", color: "var(--mc-accent)", background: "var(--mc-brand-soft)" }}
                                onClick={() => setOrderModalTab('imaging')}
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                                </svg>
                                Order Imaging
                            </button>
                        </div>
                    </div>
                )}

                {/* Read-only banner */}
                {!hasWriteAccess && hasReadAccess && !loading && (
                    <div className="pr-info-banner">
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span><strong>Read-Only Access</strong> – You can view records but need write permission to add new records.</span>
                    </div>
                )}

                {/* Add Record Form */}
                {showAddForm && (
                    <AddMedicalRecordForm
                        patientId={patientId}
                        onSuccess={() => { setShowAddForm(false); fetchPatientRecords(); }}
                        onCancel={() => setShowAddForm(false)}
                    />
                )}

                {/* States */}
                {loading ? (
                    <div className="pr-loading">
                        <div className="pr-spinner" />
                        <p>Loading medical records…</p>
                    </div>
                ) : error ? (
                    <div className="pr-error-banner">
                        {error}<br />
                        <small style={{ opacity: 0.7 }}>You may not have consent to view this patient's records.</small>
                    </div>
                ) : records.length === 0 ? (
                    <div className="pr-empty-state pr-glass-card">
                        <svg width="52" height="52" fill="none" stroke="var(--mc-accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>No medical records found for this patient.</p>
                    </div>
                ) : (
                    <>
                        <h2 className="pr-section-heading">Medical Records</h2>
                        <div className="pr-records-list">
                            {records.map(record => {
                                const isExpanded = expandedRecords.has(record.id);
                                const shouldShowToggle = record.description && record.description.length > 150;
                                return (
                                    <div key={record.id} className="pr-record-card pr-glass-card">
                                        <div className="pr-record-header">
                                            <div>
                                                <span className="pr-record-type-badge">{formatRecordType(record.type)}</span>
                                                <h3 className="pr-record-title">{record.title}</h3>
                                            </div>
                                            <span className="pr-record-date">{formatDate(record.created_at)}</span>
                                        </div>
                                        <div className="pr-record-body">
                                            <div className="pr-record-field">
                                                <strong>Description</strong>
                                                <p className={isExpanded ? '' : 'collapsed'}>{record.description}</p>
                                                {shouldShowToggle && (
                                                    <button className="pr-expand-btn" onClick={() => toggleExpand(record.id)}>
                                                        {isExpanded ? 'Show Less ↑' : 'Show More ↓'}
                                                    </button>
                                                )}
                                            </div>
                                            {record.created_by_name && (
                                                <div className="pr-record-field">
                                                    <strong>Created by</strong>
                                                    <p>{record.created_by_name} ({record.created_by_role})</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Order Tests Modal */}
            {orderModalTab && (
                <OrderTestsModal
                    patientId={patientId}
                    patientName={patientInfo?.name}
                    visitId={null}
                    initialTab={orderModalTab}
                    onClose={() => setOrderModalTab(null)}
                />
            )}
        </div>
    );
}

export default PatientMedicalRecords;
