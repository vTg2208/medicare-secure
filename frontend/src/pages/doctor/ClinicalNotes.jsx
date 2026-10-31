import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { visitApi } from '../../api/visitApi';
import { emrApi } from '../../api/emrApi';
import ClinicalNotesEditor from '../../components/clinical/ClinicalNotesEditor';
import PrescriptionForm from '../../components/clinical/PrescriptionForm';
import DiagnosisSelector from '../../components/clinical/DiagnosisSelector';
import ThemeToggle from '../../components/common/ThemeToggle';
import './ClinicalNotes.css';

function ClinicalNotes() {
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();

    // Allow pre-selecting via URL query params (e.g. from active-visits page)
    const preVisitId = searchParams.get('visitId');
    const prePatientId = searchParams.get('patientId');

    const [visits, setVisits] = useState([]);
    const [visitsLoading, setVisitsLoading] = useState(true);
    const [visitsError, setVisitsError] = useState(null);

    const [selectedVisit, setSelectedVisit] = useState(null);
    const [visitId, setVisitId] = useState(preVisitId || '');
    const [patientId, setPatientId] = useState(prePatientId || '');

    const [activeTab, setActiveTab] = useState('notes');
    const [prescriptions, setPrescriptions] = useState([]);
    const [diagnoses, setDiagnoses] = useState([]);
    const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
    const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Fetch the doctor's active/assigned visits
    const handleSelectVisit = useCallback(async (visit) => {
        setSelectedVisit(visit);
        const vId = visit.id || visit.visit_id || '';
        const pId = visit.patient_id || visit.patientId || '';
        setVisitId(vId);
        setPatientId(pId);
        setActiveTab('notes');
        setPrescriptions([]);
        setDiagnoses([]);
        setShowPrescriptionForm(false);
        setShowDiagnosisForm(false);

        // Fetch existing records for this visit
        if (vId) {
            try {
                const [rxRes, dxRes] = await Promise.all([
                    emrApi.getVisitPrescriptions(vId),
                    emrApi.getVisitDiagnoses(vId)
                ]);
                if (rxRes.success) setPrescriptions(rxRes.data || []);
                if (dxRes.success) setDiagnoses(dxRes.data || []);
            } catch (error) {
            }
        }
    }, []);

    useEffect(() => {
        const fetchVisits = async () => {
            setVisitsLoading(true);
            setVisitsError(null);
            try {
                const res = await visitApi.getActiveVisits();
                const list = Array.isArray(res) ? res : (res?.data || []);
                setVisits(list);

                // If pre-selected via URL, auto-select that visit
                if (preVisitId && list.length > 0) {
                    const pre = list.find(v => String(v.id) === String(preVisitId));
                    if (pre) handleSelectVisit(pre);
                }
            } catch (err) {
                setVisitsError('Failed to load active visits. Please try again.');
            } finally {
                setVisitsLoading(false);
            }
        };
        fetchVisits();
    }, [preVisitId, handleSelectVisit]);

    const handleChangePatient = () => {
        setSelectedVisit(null);
        setVisitId('');
        setPatientId('');
    };

    const handleSaveNotes = (savedRecord) => {
        // If the editor returned the created record, store its ID so
        // subsequent prescriptions / diagnoses can be linked to it.
        if (savedRecord?.id && selectedVisit) {
            setSelectedVisit(prev => ({ ...prev, record_id: savedRecord.id }));
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
    };

    const handleAddPrescription = async (prescription) => {
        try {
            const res = await emrApi.createPrescription({
                ...prescription,
                visitId,
                patientId,
                recordId: selectedVisit?.record_id // Usually needs a recordId from the visit
            });
            if (res.success) {
                setPrescriptions([...prescriptions, res.data]);
                setShowPrescriptionForm(false);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to add prescription');
        }
    };

    const handleRemovePrescription = (id) => {
        setPrescriptions(prescriptions.filter(p => p.id !== id));
    };

    const handleAddDiagnosis = async (diagnosis) => {
        try {
            const res = await emrApi.createDiagnosis({
                ...diagnosis,
                visitId,
                patientId,
                recordId: selectedVisit?.record_id
            });
            if (res.success) {
                setDiagnoses([...diagnoses, res.data]);
                setShowDiagnosisForm(false);
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to add diagnosis');
        }
    };

    const handleRemoveDiagnosis = (id) => {
        setDiagnoses(diagnoses.filter(d => d.id !== id));
    };

    const getPatientName = (visit) => {
        if (visit.patient_first_name && visit.patient_last_name)
            return `${visit.patient_first_name} ${visit.patient_last_name}`;
        if (visit.patientName) return visit.patientName;
        return `Patient #${visit.patient_id || visit.patientId || 'Unknown'}`;
    };

    return (
        <div className="cn-wrapper">
            {/* Theme Toggle */}
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 50 }}>
                <ThemeToggle />
            </div>

            {/* Save Success Toast */}
            {saveSuccess && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 999,
                    background: "var(--mc-success-solid)", color: "var(--mc-on-brand)",
                    padding: '12px 20px', borderRadius: 'var(--mc-radius-panel)',
                    fontWeight: 600, fontSize: 14,
                    boxShadow: 'var(--mc-shadow-panel)',
                    display: 'flex', alignItems: 'center', gap: 8
                }}>
                    ✓ Clinical notes saved successfully!
                </div>
            )}

            {/* Top Bar */}
            <div className="cn-topbar">
                <div className="cn-topbar-left">
                    <div className="cn-topbar-icon">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="cn-topbar-title">Clinical Notes</h1>
                        <p className="cn-topbar-subtitle">
                            {selectedVisit
                                ? `Visit ID: ${visitId}  ·  Patient ID: ${patientId}`
                                : 'Select a patient visit to begin'}
                        </p>
                    </div>
                </div>
                <div className="cn-topbar-actions">
                    {selectedVisit && (
                        <button className="cn-btn-outline" onClick={handleChangePatient}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Change Patient
                        </button>
                    )}
                    <button className="cn-btn-outline" onClick={() => navigate('/doctor/dashboard')}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="cn-body">
                {/* ── Selection View ── */}
                {!selectedVisit && (
                    <div className="cn-glass-card" style={{ padding: '32px' }}>
                        <div className="cn-selection-header">
                            <h2>Select a Patient</h2>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--mc-text-muted)" }}>Choose an active visit to populate the Visit and Patient details.</p>
                        </div>

                        {visitsLoading && (
                            <div className="cn-loading">
                                <div className="cn-spinner" />
                                <p>Loading your assigned visits…</p>
                            </div>
                        )}

                        {visitsError && (
                            <div className="cn-error-box">
                                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{visitsError}</p>
                                <button onClick={() => window.location.reload()} className="cn-btn-outline" style={{ margin: '0 auto', background: 'transparent' }}>Retry</button>
                            </div>
                        )}

                        {!visitsLoading && !visitsError && visits.length === 0 && (
                            <div className="cn-empty-state">
                                <svg width="56" height="56" fill="none" stroke="var(--mc-accent)" strokeWidth="1.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <h3>No Active Visits Assigned</h3>
                                <p>You have no patients currently assigned. Check the Consultation Queue.</p>
                                <button className="cn-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate('/doctor/active-visits')}>
                                    View Consultation Queue
                                </button>
                            </div>
                        )}

                        {!visitsLoading && !visitsError && visits.length > 0 && (
                            <div className="cn-selection-list">
                                {visits.map(visit => (
                                    <button
                                        key={visit.id}
                                        onClick={() => handleSelectVisit(visit)}
                                        className="cn-patient-btn cn-glass-card"
                                    >
                                        <div className="cn-patient-flex">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div className="cn-patient-avatar">
                                                    {getPatientName(visit).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="cn-patient-name">{getPatientName(visit)}</p>
                                                    <p className="cn-patient-meta">
                                                        Visit: {visit.id} &nbsp;·&nbsp; Patient: {visit.patient_id || visit.patientId || 'N/A'}
                                                    </p>
                                                    {visit.reason && <p className="cn-patient-reason">Reason: {visit.reason}</p>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {visit.status && (
                                                    <span className="cn-badge">{visit.status?.replace('_', ' ')}</span>
                                                )}
                                                <svg width="20" height="20" fill="none" stroke="var(--mc-text-subtle)" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}


                {/* ── Editor View ── */}
                {selectedVisit && (
                    <>
                        {/* Selected patient banner */}
                        <div className="cn-selected-banner cn-glass-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div className="cn-patient-avatar" style={{ width: 42, height: 42, fontSize: 16 }}>
                                    {getPatientName(selectedVisit).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="cn-patient-name" style={{ fontSize: 15 }}>{getPatientName(selectedVisit)}</p>
                                    <p className="cn-patient-meta">
                                        Visit ID: <strong style={{ color: "var(--mc-accent)" }}>{visitId}</strong>
                                        &nbsp;·&nbsp;
                                        Patient ID: <strong style={{ color: "var(--mc-accent)" }}>{patientId}</strong>
                                        {selectedVisit.reason && <>&nbsp;·&nbsp;{selectedVisit.reason}</>}
                                    </p>
                                </div>
                            </div>
                            {selectedVisit.status && (
                                <span className="cn-badge">{selectedVisit.status?.replace('_', ' ')}</span>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="cn-tabs-container">
                            {[
                                { key: 'notes', label: 'SOAP Notes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                                { key: 'prescriptions', label: 'Prescriptions', badge: prescriptions.length, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
                                { key: 'diagnoses', label: 'Diagnoses', badge: diagnoses.length, icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    className={`cn-tab ${activeTab === tab.key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
                                    </svg>
                                    {tab.label}
                                    {tab.badge > 0 && <span className="cn-tab-badge">{tab.badge}</span>}
                                </button>
                            ))}
                        </div>

                        {/* Tab contents */}
                        <div className="cn-tab-content">
                            {/* Notes */}
                            {activeTab === 'notes' && (
                                <div className="cn-glass-card" style={{ padding: 24 }}>
                                    <ClinicalNotesEditor
                                        visitId={visitId}
                                        patientId={patientId}
                                        onSave={handleSaveNotes}
                                        onCancel={() => navigate('/doctor/dashboard')}
                                    />
                                </div>
                            )}

                            {/* Prescriptions */}
                            {activeTab === 'prescriptions' && (
                                <div className="cn-glass-card" style={{ padding: 32 }}>
                                    {!showPrescriptionForm ? (
                                        <>
                                            <div className="cn-section-header">
                                                <h3>Prescriptions for this Visit</h3>
                                                <button className="cn-btn-primary" onClick={() => setShowPrescriptionForm(true)}>+ Add Prescription</button>
                                            </div>
                                            {prescriptions.length === 0 ? (
                                                <div className="cn-empty-state">
                                                    <svg width="48" height="48" fill="none" stroke="var(--mc-accent)" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M3 6l3-3 3 3m6 0l3-3 3 3M5 20h14a2 2 0 002-2V7H3v11a2 2 0 002 2z" /></svg>
                                                    <p>No prescriptions added yet.</p>
                                                </div>
                                            ) : (
                                                <div className="cn-list">
                                                    {prescriptions.map(rx => (
                                                        <div key={rx.id} className="cn-detail-card cn-glass-card">
                                                            <div className="cn-detail-header">
                                                                <h4 className="cn-detail-title">{rx.medication}</h4>
                                                                <button className="cn-btn-icon" onClick={() => handleRemovePrescription(rx.id)}>
                                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            </div>
                                                            <div className="cn-detail-grid">
                                                                <div className="cn-detail-item"><label>Dosage</label><p>{rx.dosage}</p></div>
                                                                <div className="cn-detail-item"><label>Frequency</label><p>{rx.frequency}</p></div>
                                                                {rx.duration && <div className="cn-detail-item"><label>Duration</label><p>{rx.duration}</p></div>}
                                                                <div className="cn-detail-item"><label>Route</label><p>{rx.route}</p></div>
                                                                {rx.instructions && <div className="cn-detail-item full"><label>Instructions</label><p>{rx.instructions}</p></div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <PrescriptionForm onAdd={handleAddPrescription} onCancel={() => setShowPrescriptionForm(false)} />
                                    )}
                                </div>
                            )}

                            {/* Diagnoses */}
                            {activeTab === 'diagnoses' && (
                                <div className="cn-glass-card" style={{ padding: 32 }}>
                                    {!showDiagnosisForm ? (
                                        <>
                                            <div className="cn-section-header">
                                                <h3>Diagnoses for this Visit</h3>
                                                <button className="cn-btn-primary" onClick={() => setShowDiagnosisForm(true)}>+ Add Diagnosis</button>
                                            </div>
                                            {diagnoses.length === 0 ? (
                                                <div className="cn-empty-state">
                                                    <svg width="48" height="48" fill="none" stroke="var(--mc-accent)" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                                                    <p>No diagnoses added yet.</p>
                                                </div>
                                            ) : (
                                                <div className="cn-list">
                                                    {diagnoses.map(dx => (
                                                        <div key={dx.id} className="cn-detail-card cn-glass-card">
                                                            <div className="cn-detail-header">
                                                                <div>
                                                                    <div className="cn-dx-code">{dx.code}</div>
                                                                    <h4 className="cn-detail-title">{dx.description}</h4>
                                                                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                                                                        <span className="cn-badge">{dx.type}</span>
                                                                        <span className="cn-badge" style={{ background: "var(--mc-success-bg)", color: "var(--mc-success)", borderColor: "var(--mc-success-border)" }}>{dx.status}</span>
                                                                    </div>
                                                                </div>
                                                                <button className="cn-btn-icon" onClick={() => handleRemoveDiagnosis(dx.id)}>
                                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            </div>
                                                            {dx.notes && <div className="cn-notes-box"><strong>Notes:</strong> {dx.notes}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <DiagnosisSelector onAdd={handleAddDiagnosis} onCancel={() => setShowDiagnosisForm(false)} />
                                    )}
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ClinicalNotes;
