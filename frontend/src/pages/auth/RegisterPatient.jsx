import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { authApi } from '../../api/authApi';
import './Auth.css';
function RegisterPatient() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Registration, 2: OTP Verification
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
    });
    const [otp, setOtp] = useState('');
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        try {
            await authApi.registerPatient(formData);
            setStep(2); // Move to OTP verification
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };
    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await authApi.verifyOTP(formData.email, otp);
            navigate('/login', { state: { message: 'Registration successful! Please login.' } });
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };
    if (step === 2) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <h2>Verify Your Email</h2>
                    <p className="auth-subtitle">
                        We've sent a 6-digit code to {formData.email}
                    </p>
                    <form onSubmit={handleVerifyOTP}>
                        <Input
                            label="Enter OTP"
                            type="text"
                            name="otp"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="000000"
                            required
                        />
                        {error && <div className="error-alert">{error}</div>}
                        <Button type="submit" loading={loading}>
                            Verify OTP
                        </Button>
                    </form>
                </div>
            </div>
        );
    }
    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Patient Registration</h2>
                <p className="auth-subtitle">Create your healthcare account</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <Input
                            label="First Name"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                        />
                        <Input
                            label="Last Name"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <Input
                        label="Email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        label="Phone Number"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+1234567890"
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        label="Confirm Password"
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                    {error && <div className="error-alert">{error}</div>}
                    <Button type="submit" loading={loading}>
                        Register
                    </Button>
                    <p className="auth-footer">
                        Already have an account? <a href="/login">Login</a>
                    </p>
                </form>
            </div>
        </div>
    );
}
export default RegisterPatient;