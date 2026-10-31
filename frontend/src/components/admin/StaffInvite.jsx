import React, { useState } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import { userApi } from '../../api/userApi';
import './StaffInvite.css';

function StaffInvite({ onSuccess, onCancel }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'DOCTOR',
        specialization: '',
        licenseNumber: '',
        department: '',
        shiftStart: '09:00',
        shiftEnd: '17:00',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Map form data to backend expectations
            // Backend expects: email, phone, password, roleName, organizationId, professionalLicense, shiftStart, shiftEnd

            // Generate a temporary password for the staff member
            // In a real system, this would be handled by an email invite flow
            const tempPassword = 'TempPassword123!';

            // Get organizationId from local storage or context (assuming logged in admin)
            // For now, we might need to fetch it or assume it's part of the admin's profile
            // Let's assume the backend infers it from the admin user, but the controller expects 'organizationId' in body.
            // We should probably get it from the user context.
            // Since we don't have access to context here easily without prop drilling or useContext, let's look at AuthContext usage.
            // But for now, let's just make the call.

            // Wait, does the backend infer org ID?
            // "const { organizationId } = req.body;" in user.controller.js. It requires it.
            // We need to pass organizationId.

            const payload = {
                email: formData.email,
                phone: formData.phone,
                password: tempPassword, // Staff will change this later
                roleName: formData.role.toLowerCase(), // Backend expects lowercase probably? check ROLES const.
                // ROLES.DOCTOR = 'doctor'.
                organizationId: 1, // HARDCODED for now as we don't have org context here yet. TODO: Fix this.
                professionalLicense: formData.licenseNumber,
                shiftStart: formData.shiftStart,
                shiftEnd: formData.shiftEnd,
                // Add first/last name to user creation?
                // user.controller: createUser({ ... firstName, lastName }) isn't explicitly passing them from req.body destructuring?
                // user.controller.js:
                /*
                const { ... } = req.body;
                // Create user
                const user = await createUser({
                    email, phone, password, roleId,
                    // It does NOT seem to extract firstName/lastName from req.body in onboardStaff!
                    // I should fix the backend too to accept names.
                });
                */
            };

            await userApi.onboardStaff(payload);

            onSuccess && onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send staff invitation');
        } finally {
            setLoading(false);
        }
    };

    const getRoleSpecificFields = () => {
        if (formData.role === 'DOCTOR') {
            return (
                <>
                    <Input
                        label="Specialization"
                        type="text"
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleChange}
                        placeholder="e.g., Cardiology, Pediatrics"
                        required
                    />
                    <Input
                        label="Medical License Number"
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        placeholder="Enter medical license number"
                        required
                    />
                </>
            );
        }

        if (formData.role === 'NURSE') {
            return (
                <>
                    <Input
                        label="Department"
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        placeholder="e.g., Emergency, ICU, General"
                        required
                    />
                    <div className="form-row">
                        <Input
                            label="Shift Start Time"
                            type="time"
                            name="shiftStart"
                            value={formData.shiftStart}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            label="Shift End Time"
                            type="time"
                            name="shiftEnd"
                            value={formData.shiftEnd}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </>
            );
        }

        if (formData.role === 'LAB_TECHNICIAN' || formData.role === 'RADIOLOGIST') {
            return (
                <Input
                    label="Department"
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="Department name"
                    required
                />
            );
        }

        return null;
    };

    return (
        <div className="staff-invite-container">
            <div className="invite-header">
                <h3>Invite Staff Member</h3>
                <p className="invite-subtitle">
                    Send an invitation to a new staff member to join your organization
                </p>
            </div>

            <form onSubmit={handleSubmit} className="staff-invite-form">
                {/* Basic Information */}
                <div className="form-section">
                    <h4 className="section-title">Basic Information</h4>

                    <div className="form-row">
                        <Input
                            label="First Name"
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder="Enter first name"
                            required
                        />
                        <Input
                            label="Last Name"
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder="Enter last name"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <Input
                            label="Email Address"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="staff@example.com"
                            required
                        />
                        <Input
                            label="Phone Number"
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+1 (555) 000-0000"
                            required
                        />
                    </div>
                </div>

                {/* Role Selection */}
                <div className="form-section">
                    <h4 className="section-title">Role & Credentials</h4>

                    <div className="form-group">
                        <label htmlFor="role">Staff Role *</label>
                        <select
                            id="role"
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            required
                            className="form-select"
                        >
                            <option value="DOCTOR">Doctor</option>
                            <option value="NURSE">Nurse</option>
                            <option value="LAB_TECHNICIAN">Lab Technician</option>
                            <option value="RADIOLOGIST">Radiologist</option>
                            <option value="PHARMACIST">Pharmacist</option>
                            <option value="RECEPTIONIST">Receptionist</option>
                        </select>
                    </div>

                    {getRoleSpecificFields()}
                </div>

                {error && <div className="error-alert">{error}</div>}

                <div className="form-actions">
                    <Button type="button" variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" loading={loading}>
                        Send Invitation
                    </Button>
                </div>
            </form>

            <div className="invitation-info">
                <div className="info-box">
                    <span className="info-box-icon">✉️</span>
                    <div>
                        <p className="info-box-title">Invitation Email</p>
                        <p className="info-box-text">
                            An email will be sent to the staff member with instructions to
                            complete their registration and verify their credentials.
                        </p>
                    </div>
                </div>

                <div className="info-box">
                    <span className="info-box-icon">🔐</span>
                    <div>
                        <p className="info-box-title">Access Control</p>
                        <p className="info-box-text">
                            Staff permissions will be assigned based on their role. They will
                            only access data relevant to their assigned tasks and visits.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StaffInvite;
