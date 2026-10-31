import React, { useState } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import CategoryFilter from './CategoryFilter';
import './DelegationForm.css';

function DelegationForm({ onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        delegateeName: '',
        delegateeEmail: '',
        delegateePhone: '',
        relationship: 'FAMILY',
        dataCategories: [],
        accessLevel: 'READ',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        purpose: 'CAREGIVING',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleCategoriesChange = (categories) => {
        setFormData({
            ...formData,
            dataCategories: categories,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.dataCategories.length === 0) {
            setError('Please select at least one data category to delegate');
            return;
        }

        setLoading(true);

        try {
            // TODO: Replace with actual API call
            // await consentApi.delegateAccess(formData);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            onSuccess && onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delegate access');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="delegation-form-container">
            <div className="delegation-header">
                <h3>Delegate Data Access</h3>
                <p className="delegation-subtitle">
                    Grant limited access to your medical data to a trusted caregiver or family member
                </p>
            </div>

            <form onSubmit={handleSubmit} className="delegation-form">
                {/* Delegatee Information */}
                <div className="form-section">
                    <h4 className="section-title">Delegatee Information</h4>

                    <Input
                        label="Full Name"
                        type="text"
                        name="delegateeName"
                        value={formData.delegateeName}
                        onChange={handleChange}
                        placeholder="Enter delegatee's full name"
                        required
                    />

                    <div className="form-row">
                        <Input
                            label="Email Address"
                            type="email"
                            name="delegateeEmail"
                            value={formData.delegateeEmail}
                            onChange={handleChange}
                            placeholder="delegatee@example.com"
                            required
                        />
                        <Input
                            label="Phone Number"
                            type="tel"
                            name="delegateePhone"
                            value={formData.delegateePhone}
                            onChange={handleChange}
                            placeholder="+1 (555) 000-0000"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="relationship">Relationship *</label>
                        <select
                            id="relationship"
                            name="relationship"
                            value={formData.relationship}
                            onChange={handleChange}
                            required
                            className="form-select"
                        >
                            <option value="FAMILY">Family Member</option>
                            <option value="SPOUSE">Spouse/Partner</option>
                            <option value="PARENT">Parent</option>
                            <option value="CHILD">Child</option>
                            <option value="CAREGIVER">Professional Caregiver</option>
                            <option value="LEGAL_GUARDIAN">Legal Guardian</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>
                </div>

                {/* Access Configuration */}
                <div className="form-section">
                    <h4 className="section-title">Access Configuration</h4>

                    <CategoryFilter
                        selectedCategories={formData.dataCategories}
                        onChange={handleCategoriesChange}
                    />

                    <div className="form-row" style={{ marginTop: '20px' }}>
                        <div className="form-group">
                            <label htmlFor="accessLevel">Access Level *</label>
                            <select
                                id="accessLevel"
                                name="accessLevel"
                                value={formData.accessLevel}
                                onChange={handleChange}
                                required
                                className="form-select"
                            >
                                <option value="READ">View Only</option>
                                <option value="WRITE">View & Update</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="purpose">Purpose *</label>
                            <select
                                id="purpose"
                                name="purpose"
                                value={formData.purpose}
                                onChange={handleChange}
                                required
                                className="form-select"
                            >
                                <option value="CAREGIVING">Caregiving</option>
                                <option value="EMERGENCY">Emergency Contact</option>
                                <option value="LEGAL">Legal Representation</option>
                                <option value="COORDINATION">Care Coordination</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Time Period */}
                <div className="form-section">
                    <h4 className="section-title">Validity Period</h4>

                    <div className="form-row">
                        <Input
                            label="Start Date"
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            label="End Date (Optional)"
                            type="date"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="validity-note">
                        <span className="note-icon">ℹ️</span>
                        <p>
                            If no end date is specified, the delegation will remain active
                            until you revoke it manually.
                        </p>
                    </div>
                </div>

                {error && <div className="error-alert">{error}</div>}

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Delegate Access
                    </Button>
                </div>
            </form>

            <div className="delegation-warning">
                <span className="warning-icon">⚠️</span>
                <div>
                    <strong>Important:</strong> The delegated person will receive access
                    to the selected medical data categories. You can revoke this delegation
                    at any time from your consent management page. All access will be logged
                    and auditable.
                </div>
            </div>
        </div>
    );
}

export default DelegationForm;
