import React, { useState } from 'react';
import apiClient from '../../api/client';
import Button from '../common/Button';
import './AddMedicalRecordForm.css';

function AddMedicalRecordForm({ patientId, onSuccess, onCancel }) {
    const [formData, setFormData] = useState({
        type: 'consultation',
        title: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const recordTypes = [
        { value: 'consultation', label: 'Consultation' },
        { value: 'diagnosis', label: 'Diagnosis' },
        { value: 'prescription', label: 'Prescription' },
        { value: 'lab_result', label: 'Lab Result' },
        { value: 'imaging', label: 'Imaging Report' },
        { value: 'procedure', label: 'Procedure' },
        { value: 'note', label: 'Clinical Note' },
        { value: 'other', label: 'Other' }
    ];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!formData.title.trim() || !formData.description.trim()) {
            setError('Title and description are required');
            return;
        }

        setLoading(true);

        try {
            const data = await apiClient.post('/emr/medical-records', {
                patientId,
                type: formData.type,
                title: formData.title,
                description: formData.description,
                visitId: null
            });

            if (!data.data.success) {
                throw new Error(data.data.message || 'Failed to create medical record');
            }

            setFormData({ type: 'consultation', title: '', description: '' });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="add-record-form-container">
            <div className="form-header">
                <h3>Add Medical Record</h3>
                <button className="close-btn" onClick={onCancel} aria-label="Close">×</button>
            </div>

            <form onSubmit={handleSubmit} className="add-record-form">
                {error && (
                    <div className="error-alert">
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="type">Record Type *</label>
                    <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        required
                    >
                        {recordTypes.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="title">Title *</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="e.g., Annual Physical Examination"
                        required
                        maxLength={255}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description *</label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Enter detailed notes, findings, recommendations..."
                        required
                        rows={8}
                    />
                    <small className="char-count">
                        {formData.description.length} characters
                    </small>
                </div>

                <div className="form-actions">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Record'}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default AddMedicalRecordForm;
