import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import './DiagnosisForm.css';

function DiagnosisForm({ visitId, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        icdCode: '',
        description: '',
        severity: 'MODERATE',
        notes: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: API call to create diagnosis
            // await emrApi.createDiagnosis(visitId, formData);

            if (onSuccess) onSuccess();
        } catch (error) {
            alert('Failed to save diagnosis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="diagnosis-form-container">
            <div className="form-header">
                <h3>Add Diagnosis</h3>
                <p className="form-subtitle">Record patient diagnosis (immutable after submission)</p>
            </div>

            <div className="immutability-notice">
                <span className="notice-icon">🔒</span>
                <div>
                    <strong>Immutable Record</strong>
                    <p>Diagnoses cannot be deleted. Amendments create new versions.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="diagnosis-form">
                <Input
                    label="ICD-10 Code"
                    name="icdCode"
                    value={formData.icdCode}
                    onChange={handleChange}
                    placeholder="e.g., J00 (Acute nasopharyngitis)"
                    required
                />

                <Input
                    label="Diagnosis Description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Detailed diagnosis description"
                    required
                />

                <div className="input-group">
                    <label className="input-label">
                        Severity <span className="required">*</span>
                    </label>
                    <select
                        name="severity"
                        value={formData.severity}
                        onChange={handleChange}
                        className="select-field"
                        required
                    >
                        <option value="MILD">Mild</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="SEVERE">Severe</option>
                        <option value="CRITICAL">Critical</option>
                    </select>
                </div>

                <div className="input-group">
                    <label className="input-label">Clinical Notes</label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="3"
                        placeholder="Additional diagnostic notes and observations..."
                    />
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Save Diagnosis
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default DiagnosisForm;
