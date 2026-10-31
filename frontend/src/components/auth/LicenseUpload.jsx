import React, { useState } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import FileUpload from '../common/FileUpload';
import './LicenseUpload.css';

function LicenseUpload({ onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        organizationType: 'HOSPITAL',
        organizationName: '',
        licenseNumber: '',
        licenseDocument: null,
        address: '',
        contactEmail: '',
        contactPhone: '',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleFileChange = (file) => {
        setFormData({
            ...formData,
            licenseDocument: file,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const submitData = new FormData();
            Object.keys(formData).forEach(key => {
                submitData.append(key, formData[key]);
            });

            // TODO: Replace with actual API call
            // await organizationApi.register(submitData);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            onSuccess && onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to register organization');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="license-upload-container">
            <div className="upload-header">
                <h3>Organization Registration</h3>
                <p className="upload-subtitle">
                    Register your healthcare facility with verified license documentation
                </p>
            </div>

            <form onSubmit={handleSubmit} className="license-form">
                {/* Organization Type */}
                <div className="form-section">
                    <h4 className="section-title">Organization Details</h4>

                    <div className="form-group">
                        <label htmlFor="organizationType">Organization Type *</label>
                        <select
                            id="organizationType"
                            name="organizationType"
                            value={formData.organizationType}
                            onChange={handleChange}
                            required
                            className="form-select"
                        >
                            <option value="HOSPITAL">Hospital</option>
                            <option value="CLINIC">Clinic</option>
                            <option value="PHARMACY">Pharmacy</option>
                            <option value="LABORATORY">Laboratory</option>
                            <option value="RADIOLOGY">Radiology Center</option>
                        </select>
                    </div>

                    <Input
                        label="Organization Name"
                        type="text"
                        name="organizationName"
                        value={formData.organizationName}
                        onChange={handleChange}
                        placeholder="Enter official organization name"
                        required
                    />

                    <Input
                        label="License Number"
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        placeholder="Enter official license number"
                        required
                    />

                    <div className="form-group">
                        <label htmlFor="address">Address *</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Enter complete address"
                            required
                            className="textarea-field"
                            rows="3"
                        />
                    </div>

                    <div className="form-row">
                        <Input
                            label="Contact Email"
                            type="email"
                            name="contactEmail"
                            value={formData.contactEmail}
                            onChange={handleChange}
                            placeholder="contact@organization.com"
                            required
                        />
                        <Input
                            label="Contact Phone"
                            type="tel"
                            name="contactPhone"
                            value={formData.contactPhone}
                            onChange={handleChange}
                            placeholder="+1 (555) 000-0000"
                            required
                        />
                    </div>
                </div>

                {/* License Document Upload */}
                <div className="form-section">
                    <h4 className="section-title">License Document</h4>
                    <div className="upload-info-box">
                        <span className="info-icon">📄</span>
                        <div>
                            <p className="info-text">
                                Upload a clear copy of your official healthcare license
                            </p>
                            <p className="info-subtext">
                                Accepted formats: PDF, JPG, PNG (Max 5MB)
                            </p>
                        </div>
                    </div>

                    <FileUpload
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        maxSize={5}
                        required
                    />

                    {formData.licenseDocument && (
                        <div className="file-preview">
                            <span className="file-icon">✓</span>
                            <span className="file-name">{formData.licenseDocument.name}</span>
                            <span className="file-size">
                                ({(formData.licenseDocument.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                        </div>
                    )}
                </div>

                {/* Administrator Details */}
                <div className="form-section">
                    <h4 className="section-title">Administrator Account</h4>

                    <div className="form-row">
                        <Input
                            label="First Name"
                            type="text"
                            name="adminFirstName"
                            value={formData.adminFirstName}
                            onChange={handleChange}
                            placeholder="Admin first name"
                            required
                        />
                        <Input
                            label="Last Name"
                            type="text"
                            name="adminLastName"
                            value={formData.adminLastName}
                            onChange={handleChange}
                            placeholder="Admin last name"
                            required
                        />
                    </div>

                    <Input
                        label="Administrator Email"
                        type="email"
                        name="adminEmail"
                        value={formData.adminEmail}
                        onChange={handleChange}
                        placeholder="admin@organization.com"
                        required
                    />
                </div>

                {error && <div className="error-alert">{error}</div>}

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Submit for Verification
                    </Button>
                </div>
            </form>

            <div className="verification-notice">
                <span className="notice-icon">⏱️</span>
                <div>
                    <strong>Verification Process:</strong> Your organization will be reviewed
                    by our compliance team within 2-3 business days. You'll receive a notification
                    once approved.
                </div>
            </div>
        </div>
    );
}

export default LicenseUpload;
