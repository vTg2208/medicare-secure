import React, { useState } from 'react';
import './DiagnosisSelector.css';

function DiagnosisSelector({ onAdd, onCancel }) {
    const [diagnosis, setDiagnosis] = useState({
        icdCode: '',
        description: '',
        isPrimary: true,
        status: 'active',
        notes: '',
    });

    const commonDiagnoses = [
        { code: 'J06.9', description: 'Upper Respiratory Infection' },
        { code: 'I10', description: 'Essential Hypertension' },
        { code: 'E11.9', description: 'Type 2 Diabetes Mellitus' },
        { code: 'M79.3', description: 'Myalgia (Muscle Pain)' },
        { code: 'R51', description: 'Headache' },
        { code: 'K21.9', description: 'Gastroesophageal Reflux Disease' },
        { code: 'J45.909', description: 'Asthma, Unspecified' },
        { code: 'M25.50', description: 'Joint Pain' },
        { code: 'R50.9', description: 'Fever, Unspecified' },
        { code: 'J02.9', description: 'Acute Pharyngitis' },
    ];

    const handleQuickSelect = (item) => {
        setDiagnosis({
            ...diagnosis,
            icdCode: item.code,
            description: item.description,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (diagnosis.icdCode && diagnosis.description) {
            onAdd && onAdd(diagnosis);
            // Reset form
            setDiagnosis({
                icdCode: '',
                description: '',
                isPrimary: true,
                status: 'active',
                notes: '',
            });
        }
    };

    return (
        <div className="diagnosis-selector-container">
            <div className="form-header">
                <h3>Add Diagnosis</h3>
                <p className="form-subtitle">Select from common diagnoses or enter ICD-10 code manually</p>
            </div>

            {/* Quick Select */}
            <div className="quick-select-section">
                <label className="section-label">Quick Select (Common Diagnoses)</label>
                <div className="diagnosis-chips">
                    {commonDiagnoses.map((item) => (
                        <button
                            key={item.code}
                            type="button"
                            className="diagnosis-chip"
                            onClick={() => handleQuickSelect(item)}
                        >
                            <span className="chip-code">{item.code}</span>
                            <span className="chip-description">{item.description}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="form-divider">
                <span>OR</span>
            </div>

            {/* Manual Entry */}
            <form className="diagnosis-form" onSubmit={handleSubmit}>
                <div className="form-section">
                    <div className="form-row">
                        <div className="form-group">
                            <label>ICD-10 Code *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., J06.9"
                                value={diagnosis.icdCode}
                                onChange={(e) => setDiagnosis({ ...diagnosis, icdCode: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Description *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Upper Respiratory Infection"
                                value={diagnosis.description}
                                onChange={(e) => setDiagnosis({ ...diagnosis, description: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Type</label>
                            <select
                                className="form-select"
                                value={diagnosis.isPrimary ? 'primary' : 'secondary'}
                                onChange={(e) => setDiagnosis({ ...diagnosis, isPrimary: e.target.value === 'primary' })}
                            >
                                <option value="primary">Primary</option>
                                <option value="secondary">Secondary</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select
                                className="form-select"
                                value={diagnosis.status}
                                onChange={(e) => setDiagnosis({ ...diagnosis, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="resolved">Resolved</option>
                                <option value="chronic">Chronic</option>
                                <option value="ruled_out">Ruled Out</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Clinical Notes</label>
                        <textarea
                            className="textarea-field"
                            rows="3"
                            placeholder="Additional clinical context or notes..."
                            value={diagnosis.notes}
                            onChange={(e) => setDiagnosis({ ...diagnosis, notes: e.target.value })}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                    >
                        Add Diagnosis
                    </button>
                </div>
            </form>
        </div>
    );
}

export default DiagnosisSelector;
