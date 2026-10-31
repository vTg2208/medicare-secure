import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import FileUpload from '../common/FileUpload';
import './LabUpload.css';

function LabUpload({ visitId, patientName, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [formData, setFormData] = useState({
        testType: '',
        testName: '',
        results: '',
        notes: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileSelect = (selectedFile) => {
        setFile(selectedFile);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // TODO: API call to upload lab results
            // const formDataObj = new FormData();
            // formDataObj.append('file', file);
            // formDataObj.append('testType', formData.testType);
            // formDataObj.append('testName', formData.testName);
            // formDataObj.append('results', formData.results);
            // formDataObj.append('notes', formData.notes);
            // await emrApi.uploadLabResults(visitId, formDataObj);


            if (onSuccess) onSuccess();
        } catch (error) {
            alert('Failed to upload lab results');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lab-upload-container">
            <div className="form-header">
                <h3>🔬 Upload Lab Results</h3>
                <p className="form-subtitle">Patient: {patientName || 'Unknown'}</p>
            </div>

            <div className="immutability-notice">
                <span className="notice-icon">🔒</span>
                <div>
                    <strong>Immutable Record</strong>
                    <p>Lab results cannot be modified or deleted after upload</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="lab-upload-form">
                <div className="input-group">
                    <label className="input-label">
                        Test Type <span className="required">*</span>
                    </label>
                    <select
                        name="testType"
                        value={formData.testType}
                        onChange={handleChange}
                        className="select-field"
                        required
                    >
                        <option value="">Select test type</option>
                        <option value="BLOOD">Blood Test</option>
                        <option value="URINE">Urine Test</option>
                        <option value="CULTURE">Culture Test</option>
                        <option value="BIOPSY">Biopsy</option>
                        <option value="GENETIC">Genetic Test</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>

                <Input
                    label="Test Name"
                    name="testName"
                    value={formData.testName}
                    onChange={handleChange}
                    placeholder="e.g., Complete Blood Count (CBC)"
                    required
                />

                <div className="input-group">
                    <label className="input-label">
                        Results Summary <span className="required">*</span>
                    </label>
                    <textarea
                        name="results"
                        value={formData.results}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="4"
                        placeholder="Enter key findings and results..."
                        required
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">Additional Notes</label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="2"
                        placeholder="Any additional observations or notes..."
                    />
                </div>

                <FileUpload
                    label="Upload Lab Report (PDF, Images)"
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxSize={10}
                    onFileSelect={handleFileSelect}
                />

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading} disabled={!file}>
                        Upload Lab Results
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default LabUpload;
