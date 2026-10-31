import React, { useState } from 'react';
import Button from '../common/Button';
import './ImagingRequest.css';

function ImagingRequest({ visitId, patientId, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        imagingType: '',
        bodyPart: '',
        clinicalIndication: '',
        priority: 'ROUTINE',
        contrastRequired: false,
        specialInstructions: '',
    });

    const imagingTypes = [
        { id: 'XRAY', name: 'X-Ray', icon: '📷' },
        { id: 'CT', name: 'CT Scan', icon: '🔍' },
        { id: 'MRI', name: 'MRI', icon: '🧲' },
        { id: 'ULTRASOUND', name: 'Ultrasound', icon: '🔊' },
        { id: 'MAMMOGRAM', name: 'Mammogram', icon: '🩺' },
        { id: 'DEXA', name: 'Bone Density (DEXA)', icon: '🦴' },
    ];

    const commonBodyParts = [
        'Chest', 'Abdomen', 'Head/Brain', 'Spine', 'Pelvis',
        'Upper Extremity', 'Lower Extremity', 'Breast', 'Heart',
    ];

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
        setError('');
    };

    const handleImagingTypeSelect = (type) => {
        setFormData({
            ...formData,
            imagingType: type,
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.imagingType) {
            setError('Please select an imaging type');
            return;
        }

        if (!formData.bodyPart) {
            setError('Please select or specify the body part/area');
            return;
        }

        if (!formData.clinicalIndication) {
            setError('Please provide clinical indication');
            return;
        }

        setLoading(true);

        try {
            // TODO: Replace with actual API call
            // await imagingApi.createImagingRequest({
            //     visitId,
            //     patientId,
            //     ...formData
            // });

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            onSuccess && onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create imaging request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="imaging-request-container">
            <div className="imaging-request-header">
                <h3>Request Imaging Study</h3>
                <p className="imaging-request-subtitle">
                    Order radiology and imaging procedures for this patient
                </p>
            </div>

            <form onSubmit={handleSubmit} className="imaging-request-form">
                {/* Imaging Type Selection */}
                <div className="form-section">
                    <h4 className="section-title">Imaging Type *</h4>
                    <div className="imaging-type-grid">
                        {imagingTypes.map((type) => (
                            <div
                                key={type.id}
                                className={`imaging-type-card ${formData.imagingType === type.id ? 'selected' : ''}`}
                                onClick={() => handleImagingTypeSelect(type.id)}
                            >
                                <div className="type-icon">{type.icon}</div>
                                <div className="type-name">{type.name}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body Part Selection */}
                <div className="form-section">
                    <h4 className="section-title">Body Part / Area *</h4>
                    <select
                        name="bodyPart"
                        value={formData.bodyPart}
                        onChange={handleChange}
                        className="form-select"
                        required
                    >
                        <option value="">Select body part...</option>
                        {commonBodyParts.map((part) => (
                            <option key={part} value={part}>
                                {part}
                            </option>
                        ))}
                        <option value="OTHER">Other (specify in instructions)</option>
                    </select>
                </div>

                {/* Clinical Indication */}
                <div className="form-section">
                    <h4 className="section-title">Clinical Indication *</h4>
                    <textarea
                        name="clinicalIndication"
                        value={formData.clinicalIndication}
                        onChange={handleChange}
                        placeholder="Describe the reason for this imaging study..."
                        className="form-textarea"
                        rows="3"
                        required
                    />
                    <p className="field-hint">
                        Provide clinical symptoms, suspected diagnosis, or reason for imaging
                    </p>
                </div>

                {/* Priority Level */}
                <div className="form-section">
                    <h4 className="section-title">Priority Level</h4>
                    <div className="priority-options">
                        <label className={`priority-option ${formData.priority === 'ROUTINE' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="priority"
                                value="ROUTINE"
                                checked={formData.priority === 'ROUTINE'}
                                onChange={handleChange}
                            />
                            <div className="option-content">
                                <span className="option-icon">📅</span>
                                <div>
                                    <div className="option-label">Routine</div>
                                    <div className="option-description">Scheduled within 1-2 days</div>
                                </div>
                            </div>
                        </label>

                        <label className={`priority-option ${formData.priority === 'URGENT' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="priority"
                                value="URGENT"
                                checked={formData.priority === 'URGENT'}
                                onChange={handleChange}
                            />
                            <div className="option-content">
                                <span className="option-icon">⚡</span>
                                <div>
                                    <div className="option-label">Urgent</div>
                                    <div className="option-description">Same day or within 24 hours</div>
                                </div>
                            </div>
                        </label>

                        <label className={`priority-option ${formData.priority === 'STAT' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="priority"
                                value="STAT"
                                checked={formData.priority === 'STAT'}
                                onChange={handleChange}
                            />
                            <div className="option-content">
                                <span className="option-icon">🚨</span>
                                <div>
                                    <div className="option-label">STAT</div>
                                    <div className="option-description">Immediate - Emergency</div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Contrast Required */}
                {(formData.imagingType === 'CT' || formData.imagingType === 'MRI') && (
                    <div className="form-section">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="contrastRequired"
                                checked={formData.contrastRequired}
                                onChange={handleChange}
                            />
                            <span className="checkbox-text">
                                Contrast Media Required
                            </span>
                        </label>
                        {formData.contrastRequired && (
                            <div className="contrast-warning">
                                <span className="warning-icon">⚠️</span>
                                <p>
                                    Please ensure patient has no contraindications for contrast media
                                    (kidney function, allergies, pregnancy).
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Special Instructions */}
                <div className="form-section">
                    <h4 className="section-title">Special Instructions</h4>
                    <textarea
                        name="specialInstructions"
                        value={formData.specialInstructions}
                        onChange={handleChange}
                        placeholder="Enter any special instructions for the radiology department..."
                        className="form-textarea"
                        rows="3"
                    />
                </div>

                {error && <div className="error-alert">{error}</div>}

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Submit Imaging Request
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ImagingRequest;
