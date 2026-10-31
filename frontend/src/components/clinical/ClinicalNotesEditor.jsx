import React, { useState } from 'react';
import './ClinicalNotesEditor.css';
import { emrApi } from '../../api/emrApi';

function ClinicalNotesEditor({ visitId, patientId, onSave, onCancel }) {
    const [notes, setNotes] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        chiefComplaint: '',
        vitalSigns: {
            temperature: '',
            bloodPressure: '',
            heartRate: '',
            respiratoryRate: '',
            oxygenSaturation: '',
        }
    });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const handleVitalChange = (field, value) => {
        setNotes(prev => ({
            ...prev,
            vitalSigns: {
                ...prev.vitalSigns,
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSaveError(null);
        try {
            // Build a structured description from SOAP fields
            const vitals = notes.vitalSigns;
            const vitalsStr = [
                vitals.temperature ? `Temp: ${vitals.temperature}°F` : '',
                vitals.bloodPressure ? `BP: ${vitals.bloodPressure}` : '',
                vitals.heartRate ? `HR: ${vitals.heartRate} bpm` : '',
                vitals.respiratoryRate ? `RR: ${vitals.respiratoryRate}` : '',
                vitals.oxygenSaturation ? `O2: ${vitals.oxygenSaturation}%` : '',
            ].filter(Boolean).join(' | ');

            const description = [
                notes.chiefComplaint ? `Chief Complaint: ${notes.chiefComplaint}` : '',
                vitalsStr ? `Vitals: ${vitalsStr}` : '',
                notes.subjective ? `S (Subjective): ${notes.subjective}` : '',
                notes.objective ? `O (Objective): ${notes.objective}` : '',
                notes.assessment ? `A (Assessment): ${notes.assessment}` : '',
                notes.plan ? `P (Plan): ${notes.plan}` : '',
            ].filter(Boolean).join('\n\n');

            const res = await emrApi.createMedicalRecord({
                visitId,
                patientId,
                type: 'consultation',
                title: notes.chiefComplaint
                    ? `SOAP Note – ${notes.chiefComplaint}`
                    : `SOAP Note – Visit ${visitId}`,
                description,
            });

            onSave && onSave(res.data || notes);
        } catch (error) {
            setSaveError(error.response?.data?.message || 'Failed to save notes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="clinical-notes-editor">
            <div className="editor-header">
                <h3>Clinical Notes - SOAP Format</h3>
                <p className="editor-subtitle">Visit ID: {visitId} | Patient ID: {patientId}</p>
            </div>

            {/* Chief Complaint */}
            <div className="form-section">
                <label className="section-label">Chief Complaint</label>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Patient's primary reason for visit..."
                    value={notes.chiefComplaint}
                    onChange={(e) => setNotes({ ...notes, chiefComplaint: e.target.value })}
                />
            </div>

            {/* Vital Signs */}
            <div className="form-section vitals-section">
                <label className="section-label">Vital Signs</label>
                <div className="vitals-grid">
                    <div className="form-group">
                        <label>Temperature (°F)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="98.6"
                            value={notes.vitalSigns.temperature}
                            onChange={(e) => handleVitalChange('temperature', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Blood Pressure</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="120/80"
                            value={notes.vitalSigns.bloodPressure}
                            onChange={(e) => handleVitalChange('bloodPressure', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Heart Rate (bpm)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="72"
                            value={notes.vitalSigns.heartRate}
                            onChange={(e) => handleVitalChange('heartRate', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Respiratory Rate</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="16"
                            value={notes.vitalSigns.respiratoryRate}
                            onChange={(e) => handleVitalChange('respiratoryRate', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>O₂ Saturation (%)</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="98"
                            value={notes.vitalSigns.oxygenSaturation}
                            onChange={(e) => handleVitalChange('oxygenSaturation', e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* SOAP Notes */}
            <div className="soap-notes">
                {/* Subjective */}
                <div className="form-section">
                    <div className="section-title">
                        <span className="soap-letter">S</span>
                        Subjective
                    </div>
                    <p className="section-hint">Patient's description of symptoms, history, concerns</p>
                    <textarea
                        className="textarea-field"
                        rows="4"
                        placeholder="Patient reports..."
                        value={notes.subjective}
                        onChange={(e) => setNotes({ ...notes, subjective: e.target.value })}
                    />
                </div>

                {/* Objective */}
                <div className="form-section">
                    <div className="section-title">
                        <span className="soap-letter">O</span>
                        Objective
                    </div>
                    <p className="section-hint">Observable findings, examination results, test data</p>
                    <textarea
                        className="textarea-field"
                        rows="4"
                        placeholder="Physical examination reveals..."
                        value={notes.objective}
                        onChange={(e) => setNotes({ ...notes, objective: e.target.value })}
                    />
                </div>

                {/* Assessment */}
                <div className="form-section">
                    <div className="section-title">
                        <span className="soap-letter">A</span>
                        Assessment
                    </div>
                    <p className="section-hint">Diagnosis, clinical impression, differential diagnosis</p>
                    <textarea
                        className="textarea-field"
                        rows="4"
                        placeholder="Clinical assessment and diagnosis..."
                        value={notes.assessment}
                        onChange={(e) => setNotes({ ...notes, assessment: e.target.value })}
                    />
                </div>

                {/* Plan */}
                <div className="form-section">
                    <div className="section-title">
                        <span className="soap-letter">P</span>
                        Plan
                    </div>
                    <p className="section-hint">Treatment plan, follow-up, patient education</p>
                    <textarea
                        className="textarea-field"
                        rows="4"
                        placeholder="Treatment plan and recommendations..."
                        value={notes.plan}
                        onChange={(e) => setNotes({ ...notes, plan: e.target.value })}
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div className="form-actions">
                <button
                    className="btn btn-secondary"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Notes'}
                </button>
            </div>
            {saveError && (
                <div style={{
                    marginTop: 12, padding: '10px 16px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10, color: '#dc2626',
                    fontSize: 13, fontWeight: 500,
                }}>
                    ⚠ {saveError}
                </div>
            )}
        </div>
    );
}

export default ClinicalNotesEditor;
