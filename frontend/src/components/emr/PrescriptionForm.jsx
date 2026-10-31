import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import './PrescriptionForm.css';

function PrescriptionForm({ visitId, diagnosisId, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        medication: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: '',
        refills: '0',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: API call to create prescription
            // await emrApi.createPrescription(visitId, diagnosisId, formData);

            if (onSuccess) onSuccess();
        } catch (error) {
            alert('Failed to save prescription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="prescription-form-container">
            <div className="form-header">
                <h3>📋 New Prescription</h3>
                <p className="form-subtitle">Create digital prescription linked to diagnosis</p>
            </div>

            <form onSubmit={handleSubmit} className="prescription-form">
                <Input
                    label="Medication Name"
                    name="medication"
                    value={formData.medication}
                    onChange={handleChange}
                    placeholder="e.g., Amoxicillin"
                    required
                />

                <div className="form-row">
                    <Input
                        label="Dosage"
                        name="dosage"
                        value={formData.dosage}
                        onChange={handleChange}
                        placeholder="e.g., 500mg"
                        required
                    />
                    <Input
                        label="Frequency"
                        name="frequency"
                        value={formData.frequency}
                        onChange={handleChange}
                        placeholder="e.g., 3 times daily"
                        required
                    />
                </div>

                <div className="form-row">
                    <Input
                        label="Duration"
                        name="duration"
                        value={formData.duration}
                        onChange={handleChange}
                        placeholder="e.g., 7 days"
                        required
                    />
                    <div className="input-group">
                        <label className="input-label">
                            Refills <span className="required">*</span>
                        </label>
                        <select
                            name="refills"
                            value={formData.refills}
                            onChange={handleChange}
                            className="select-field"
                            required
                        >
                            <option value="0">No Refills</option>
                            <option value="1">1 Refill</option>
                            <option value="2">2 Refills</option>
                            <option value="3">3 Refills</option>
                            <option value="6">6 Refills</option>
                        </select>
                    </div>
                </div>

                <div className="input-group">
                    <label className="input-label">
                        Instructions <span className="required">*</span>
                    </label>
                    <textarea
                        name="instructions"
                        value={formData.instructions}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="3"
                        placeholder="e.g., Take with food. Complete full course even if symptoms improve."
                        required
                    />
                </div>

                <div className="prescription-preview">
                    <div className="preview-header">📄 Prescription Preview</div>
                    <div className="preview-content">
                        <p><strong>Rx:</strong> {formData.medication || '___________'}</p>
                        <p><strong>Dosage:</strong> {formData.dosage || '___________'}</p>
                        <p><strong>Frequency:</strong> {formData.frequency || '___________'}</p>
                        <p><strong>Duration:</strong> {formData.duration || '___________'}</p>
                        <p><strong>Refills:</strong> {formData.refills}</p>
                        {formData.instructions && (
                            <p className="preview-instructions"><strong>Instructions:</strong> {formData.instructions}</p>
                        )}
                    </div>
                </div>

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Issue Prescription
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default PrescriptionForm;
