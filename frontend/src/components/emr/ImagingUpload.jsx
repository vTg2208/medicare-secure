import React, { useState } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import FileUpload from '../common/FileUpload';
import './ImagingUpload.css';

function ImagingUpload({ visitId, patientName, onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [formData, setFormData] = useState({
        imagingType: '',
        bodyPart: '',
        findings: '',
        impression: '',
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
            // TODO: API call to upload imaging report

            if (onSuccess) onSuccess();
        } catch (error) {
            alert('Failed to upload imaging report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="imaging-upload-container">
            <div className="form-header">
                <h3>🏥 Upload Imaging Report</h3>
                <p className="form-subtitle">Patient: {patientName || 'Unknown'}</p>
            </div>

            <div className="immutability-notice">
                <span className="notice-icon">🔒</span>
                <div>
                    <strong>Immutable Record</strong>
                    <p>Imaging reports cannot be modified or deleted after upload</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="imaging-upload-form">
                <div className="form-row">
                    <div className="input-group">
                        <label className="input-label">
                            Imaging Type <span className="required">*</span>
                        </label>
                        <select
                            name="imagingType"
                            value={formData.imagingType}
                            onChange={handleChange}
                            className="select-field"
                            required
                        >
                            <option value="">Select imaging type</option>
                            <option value="XRAY">X-Ray</option>
                            <option value="CT">CT Scan</option>
                            <option value="MRI">MRI</option>
                            <option value="ULTRASOUND">Ultrasound</option>
                            <option value="MAMMOGRAM">Mammogram</option>
                            <option value="PET">PET Scan</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    <Input
                        label="Body Part / Region"
                        name="bodyPart"
                        value={formData.bodyPart}
                        onChange={handleChange}
                        placeholder="e.g., Chest, Abdomen, Head"
                        required
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">
                        Findings <span className="required">*</span>
                    </label>
                    <textarea
                        name="findings"
                        value={formData.findings}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="4"
                        placeholder="Detailed radiological findings..."
                        required
                    />
                </div>

                <div className="input-group">
                    <label className="input-label">
                        Impression <span className="required">*</span>
                    </label>
                    <textarea
                        name="impression"
                        value={formData.impression}
                        onChange={handleChange}
                        className="textarea-field"
                        rows="3"
                        placeholder="Clinical impression and recommendations..."
                        required
                    />
                </div>

                <FileUpload
                    label="Upload Imaging Files (DICOM, PDF, Images)"
                    accept=".dcm,.pdf,.jpg,.jpeg,.png"
                    maxSize={50}
                    onFileSelect={handleFileSelect}
                />

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading} disabled={!file}>
                        Upload Imaging Report
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default ImagingUpload;
