import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import './ConsultationForm.css';

function ConsultationForm({ visit, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        chiefComplaint: '',
        historyOfPresentIllness: '',
        physicalExamination: '',
        clinicalNotes: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: API call to create consultation record
            // await emrApi.createConsultation(visit.id, formData);

            if (onSuccess) onSuccess();
        } catch (error) {
            alert('Failed to save consultation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="consultation-form-container">
            <div className="form-header">
                <h3>New Consultation</h3>
                <p className="form-subtitle">Document patient consultation for Visit #{visit?.visitCode || 'N/A'}</p>
            </div>

            <div className="patient-info-bar">
                <div className="info-item">
                    <span className="info-label">Patient:</span>
                    <span className="info-value">{visit?.patientName || 'John Doe'}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Visit Date:</span>
                    <span className="info-value">{new Date(visit?.startTime || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Status:</span>
                    <span className="status-badge">{visit?.status || 'ACTIVE'}</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="consultation-form">
                <Input
                    label="Chief Complaint"
                    name="chiefComplaint"
                    value={formData.chiefComplaint}
                    onChange={handleChange}
                    placeholder="Primary reason for visit"
                    required
                />

                <div className="input-group">
                    <label className="input-label">
                        History of Present Illness <span className="required">*</span>
                    </label>
                    <textarea
                        name="historyOfPresentIllness"
                        value={formData.historyOfPresentIllness}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="4"
                        placeholder="Detailed history of the patient's current condition..."
                        required
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">
                        Physical Examination <span className="required">*</span>
                    </label>
                    <textarea
                        name="physicalExamination"
                        value={formData.physicalExamination}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="4"
                        placeholder="Physical examination findings..."
                        required
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Clinical Notes</label>
                    <textarea
                        name="clinicalNotes"
                        value={formData.clinicalNotes}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="3"
                        placeholder="Additional clinical observations and notes..."
                    />
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Save Consultation
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ConsultationForm;
