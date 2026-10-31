import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { emrApi } from '../../api/emrApi';
import './OrderTestsModal.css';

// ─── Test Catalogue ───────────────────────────────────────────────────────────
const LAB_TESTS = [
    { id: 'CBC', name: 'Complete Blood Count (CBC)', category: 'HEMATOLOGY' },
    { id: 'BLOOD_SUGAR', name: 'Blood Sugar (FBS / RBS)', category: 'CHEMISTRY' },
    { id: 'LIPID', name: 'Lipid Profile', category: 'CHEMISTRY' },
    { id: 'LFT', name: 'Liver Function Tests (LFT)', category: 'CHEMISTRY' },
    { id: 'KFT', name: 'Kidney Function Tests (KFT)', category: 'CHEMISTRY' },
    { id: 'THYROID', name: 'Thyroid Panel (TSH / T3 / T4)', category: 'CHEMISTRY' },
    { id: 'URINE_RE', name: 'Urine Routine Examination', category: 'URINE' },
    { id: 'CULTURE', name: 'Bacterial Culture & Sensitivity', category: 'MICROBIOLOGY' },
    { id: 'HBA1C', name: 'HbA1c (Glycated Haemoglobin)', category: 'CHEMISTRY' },
    { id: 'COAG', name: 'Coagulation Profile (PT / aPTT)', category: 'HEMATOLOGY' },
];

const IMAGING_TESTS = [
    { id: 'XRAY_CHEST', name: 'X-Ray – Chest (PA View)', category: 'X-RAY' },
    { id: 'XRAY_ABD', name: 'X-Ray – Abdomen', category: 'X-RAY' },
    { id: 'USG_ABD', name: 'Ultrasound – Abdomen & Pelvis', category: 'ULTRASOUND' },
    { id: 'USG_THYROID', name: 'Ultrasound – Thyroid', category: 'ULTRASOUND' },
    { id: 'CT_HEAD', name: 'CT Scan – Head (Plain)', category: 'CT' },
    { id: 'CT_CHEST', name: 'CT Scan – Chest (HRCT)', category: 'CT' },
    { id: 'CT_ABD', name: 'CT Scan – Abdomen & Pelvis', category: 'CT' },
    { id: 'MRI_BRAIN', name: 'MRI – Brain', category: 'MRI' },
    { id: 'MRI_SPINE', name: 'MRI – Spine (L/S)', category: 'MRI' },
    { id: 'ECHO', name: 'Echocardiography (ECHO)', category: 'CARDIAC' },
    { id: 'ECG', name: 'ECG / EKG', category: 'CARDIAC' },
];

const PRIORITIES = [
    { value: 'ROUTINE', label: 'Routine', color: '#16a34a' },
    { value: 'URGENT', label: 'Urgent', color: '#d97706' },
    { value: 'STAT', label: 'STAT (Emergency)', color: '#dc2626' },
];

// ─── Modal ────────────────────────────────────────────────────────────────────
function OrderTestsModal({ patientId, patientName, visitId, onClose, initialTab = 'lab' }) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [selected, setSelected] = useState([]);
    const [priority, setPriority] = useState('ROUTINE');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const testList = activeTab === 'lab' ? LAB_TESTS : IMAGING_TESTS;

    const toggleTest = (id) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelected([]);
        setError(null);
    };

    const handleSubmit = async () => {
        if (selected.length === 0) {
            setError('Please select at least one test.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Fire one request per selected test (existing API contract)
            const isImaging = activeTab === 'imaging';
            await Promise.all(
                selected.map(id => {
                    const test = testList.find(t => t.id === id);
                    const payload = {
                        visitId,
                        testCode: test.id,
                        testName: test.name,
                        testCategory: test.category,
                        priority: priority.toLowerCase(),
                        clinicalIndication: notes,
                        notes,
                    };
                    return isImaging
                        ? emrApi.createImagingOrder(payload)
                        : emrApi.createLabOrder(payload);
                })
            );
            setSuccess(true);
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Failed to submit order.');
        } finally {
            setLoading(false);
        }
    };

    const modal = ReactDOM.createPortal(
        <div className="ot-overlay" onClick={onClose}>
            <div className="ot-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="ot-header">
                    <div className="ot-header-info">
                        <span className="ot-header-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="ot-title">Order Tests</h2>
                            {patientName && <p className="ot-subtitle">Patient: {patientName}</p>}
                        </div>
                    </div>
                    <button className="ot-close" onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {success ? (
                    /* ── Success State ── */
                    <div className="ot-success">
                        <div className="ot-success-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h3>Order Submitted!</h3>
                        <p>{selected.length} test{selected.length > 1 ? 's' : ''} ordered successfully with <strong>{priority}</strong> priority.</p>
                        <button className="ot-btn-primary" onClick={onClose}>Close</button>
                    </div>
                ) : (
                    <>
                        {/* ── Tabs ── */}
                        <div className="ot-tabs">
                            <button
                                className={`ot-tab${activeTab === 'lab' ? ' active' : ''}`}
                                onClick={() => handleTabChange('lab')}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 3v11a3 3 0 006 0V3" /><line x1="6" y1="3" x2="18" y2="3" />
                                </svg>
                                Lab Tests
                            </button>
                            <button
                                className={`ot-tab${activeTab === 'imaging' ? ' active' : ''}`}
                                onClick={() => handleTabChange('imaging')}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                                </svg>
                                Imaging
                            </button>
                        </div>

                        {/* ── Test Checklist ── */}
                        <div className="ot-body">
                            <div className="ot-checklist">
                                {testList.map(test => (
                                    <label key={test.id} className={`ot-check-item${selected.includes(test.id) ? ' checked' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(test.id)}
                                            onChange={() => toggleTest(test.id)}
                                        />
                                        <span className="ot-check-box" />
                                        <span className="ot-check-label">
                                            {test.name}
                                            <span className="ot-check-cat">{test.category}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {selected.length > 0 && (
                                <div className="ot-selected-count">
                                    {selected.length} test{selected.length > 1 ? 's' : ''} selected
                                </div>
                            )}

                            {/* Priority */}
                            <div className="ot-section">
                                <label className="ot-label">Priority</label>
                                <div className="ot-priority-group">
                                    {PRIORITIES.map(p => (
                                        <label key={p.value} className={`ot-priority-btn${priority === p.value ? ' active' : ''}`} style={priority === p.value ? { borderColor: p.color, color: p.color, background: p.color + '15' } : {}}>
                                            <input
                                                type="radio"
                                                name="priority"
                                                value={p.value}
                                                checked={priority === p.value}
                                                onChange={() => setPriority(p.value)}
                                            />
                                            {p.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Clinical Notes */}
                            <div className="ot-section">
                                <label className="ot-label">Clinical Indication / Notes <span className="ot-optional">(optional)</span></label>
                                <textarea
                                    className="ot-textarea"
                                    rows={3}
                                    placeholder="Reason for test, specific instructions..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>

                            {error && <div className="ot-error">{error}</div>}
                        </div>

                        {/* ── Footer ── */}
                        <div className="ot-footer">
                            <button className="ot-btn-secondary" onClick={onClose} disabled={loading}>
                                Cancel
                            </button>
                            <button
                                className="ot-btn-primary"
                                onClick={handleSubmit}
                                disabled={loading || selected.length === 0}
                            >
                                {loading ? (
                                    <span className="ot-spinner" />
                                ) : (
                                    <>Submit Request{selected.length > 0 ? ` (${selected.length})` : ''}</>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body
    );

    return modal;
}

export default OrderTestsModal;
