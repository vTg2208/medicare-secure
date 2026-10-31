import { brandName } from '../../config/brand';
import Brand from '../../components/common/Brand';
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/authApi';
import { startRegistration } from '@simplewebauthn/browser';
import ThemeToggle from '../../components/common/ThemeToggle';

import '../patient/Dashboard.css';

function Register() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [patientData, setPatientData] = useState({
        name: '',
        aadhaarId: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [roleTab, setRoleTab] = useState('patient');
    const [doctorData, setDoctorData] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        password: '', confirmPassword: '', licenseNumber: ''
    });
    const [doctorFiles, setDoctorFiles] = useState({
        degreeCertificate: null, medicalRegCertificate: null
    });

    const [otp, setOtp] = useState('');
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [passkeyToken, setPasskeyToken] = useState(null);

    const appName = brandName;

    const handlePatientChange = (e) => setPatientData({ ...patientData, [e.target.name]: e.target.value });
    const handleDoctorChange = (e) => setDoctorData({ ...doctorData, [e.target.name]: e.target.value });
    const handleDoctorFileChange = (e) => setDoctorFiles({ ...doctorFiles, [e.target.name]: e.target.files[0] });

    const validatePasswords = (password, confirmPassword) => {
        if (password !== confirmPassword) return 'Passwords do not match';
        if (password.length < 8) return 'Password must be at least 8 characters';
        return null;
    };

    const handleSubmitPatient = async (e) => {
        e.preventDefault();
        if (roleTab !== 'patient') return;

        setError('');
        const pwdError = validatePasswords(patientData.password, patientData.confirmPassword);
        if (pwdError) { setError(pwdError); return; }
        setLoading(true);
        try {
            const res = await authApi.registerPatient(patientData);
            setStep(2);
            setSuccessMsg(res.message);
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitDoctor = async (e) => {
        e.preventDefault();
        if (roleTab !== 'doctor') return;

        setError('');
        const pwdError = validatePasswords(doctorData.password, doctorData.confirmPassword);
        if (pwdError) { setError(pwdError); return; }

        if (!doctorFiles.degreeCertificate || !doctorFiles.medicalRegCertificate) {
            setError('Please upload both the Degree Certificate and Medical Registration Certificate.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            Object.keys(doctorData).forEach(key => formData.append(key, doctorData[key]));
            formData.append('degreeCertificate', doctorFiles.degreeCertificate);
            formData.append('medicalRegCertificate', doctorFiles.medicalRegCertificate);

            const res = await authApi.registerDoctor(formData);
            setStep(4); // Dedicated doctor success screen
            setSuccessMsg(res.message);
        } catch (err) {
            setError(err.response?.data?.message || 'Doctor registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await authApi.verifyOTP(patientData.email, otp);

            // Auto-login to get a token for passkey registration
            try {
                const loginRes = await authApi.login(patientData.email, patientData.password);
                const payload = loginRes.data || loginRes;
                const token = payload.accessToken || payload.token || payload.data?.accessToken;
                if (token) {
                    setPasskeyToken(token);
                    setStep(3); // Go to passkey setup
                } else {
                    navigate('/login', { state: { message: 'Registration successful! Please login.' } });
                }
            } catch {
                // If auto-login fails, just go to login page
                navigate('/login', { state: { message: 'Registration successful! Please login.' } });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };
    const handleResendOTP = async () => {
        setError('');
        setSuccessMsg('');
        setLoading(true);
        try {
            const res = await authApi.resendOTP(patientData.email);
            setSuccessMsg(res.message || 'OTP resent successfully');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setLoading(false);
        }
    };
    const handlePasskeySetup = async () => {
        setError('');
        setPasskeyLoading(true);
        try {
            const optionsRes = await authApi.passkeyRegisterOptions(passkeyToken);
            if (!optionsRes.success) throw new Error(optionsRes.message || 'Failed to get passkey options');
            const credential = await startRegistration({ optionsJSON: optionsRes.data });
            const verifyRes = await authApi.passkeyRegisterVerify(credential, 'My Passkey', passkeyToken);
            if (!verifyRes.success) throw new Error(verifyRes.message || 'Passkey registration failed');
            navigate('/login', { state: { message: 'Registration successful! Passkey set up. You can now sign in with your passkey.' } });
        } catch (err) {
            if (err.name === 'NotAllowedError') setError('Passkey setup was cancelled. You can set it up later.');
            else setError(err.response?.data?.message || err.message || 'Passkey setup failed');
        } finally {
            setPasskeyLoading(false);
        }
    };

    return (
        <div className="patient-dashboard-wrapper min-h-screen flex items-center justify-center bg-[var(--background-light)] dark:bg-[var(--background-dark)] p-4 sm:p-6 lg:p-8 transition-colors duration-300 relative overflow-hidden">


            {/* Header with App Name and Logo */}
            <Brand to={'/'} className="absolute top-6 left-6 z-50" />

            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-xl glass-card rounded-3xl shadow-sm p-8 sm:p-10 z-10 animate-fade-in relative mt-16 sm:mt-0 border border-line dark:border-line">

                {step === 1 && (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Create Account</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Join {appName} to manage your health records securely.</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 flex items-center shadow-sm text-sm">
                                <span className="material-symbols-outlined text-[20px] mr-2">error</span>
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700/50">
                            <button
                                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${roleTab === 'patient' ? "text-primary-600 border-primary-600 dark:text-primary-400 dark:border-primary-400" : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                onClick={() => { setRoleTab('patient'); setError(''); }}
                                type="button"
                            >Patient</button>
                            <button
                                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all ${roleTab === 'doctor' ? "text-primary-600 border-primary-600 dark:text-primary-400 dark:border-primary-400" : 'text-slate-500 border-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                onClick={() => { setRoleTab('doctor'); setError(''); }}
                                type="button"
                            >Doctor</button>
                        </div>

                        {roleTab === 'patient' ? (
                            <form onSubmit={handleSubmitPatient} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Full Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                            <span className="material-symbols-outlined text-[20px]">person</span>
                                        </div>
                                        <input
                                            type="text"
                                            name="name"
                                            value={patientData.name || ''}
                                            onChange={handlePatientChange}
                                            required
                                            className="block w-full pl-12 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Aadhaar ID (Mock)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                            <span className="material-symbols-outlined text-[20px]">id_card</span>
                                        </div>
                                        <input
                                            type="text"
                                            name="aadhaarId"
                                            value={patientData.aadhaarId}
                                            onChange={handlePatientChange}
                                            required
                                            className="block w-full pl-12 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                            placeholder="1234 5678 9012"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Email</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                                <span className="material-symbols-outlined text-[20px]">mail</span>
                                            </div>
                                            <input
                                                type="email"
                                                name="email"
                                                value={patientData.email}
                                                onChange={handlePatientChange}
                                                required
                                                className="block w-full pl-12 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Phone</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                                <span className="material-symbols-outlined text-[20px]">call</span>
                                            </div>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={patientData.phone}
                                                onChange={handlePatientChange}
                                                required
                                                className="block w-full pl-12 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                                placeholder="+91 9876543210"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Password</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                                <span className="material-symbols-outlined text-[20px]">lock</span>
                                            </div>
                                            <input
                                                type="password"
                                                name="password"
                                                value={patientData.password}
                                                onChange={handlePatientChange}
                                                required
                                                className="block w-full pl-12 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Confirm</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 z-10">
                                                <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                                            </div>
                                            <input
                                                type="password"
                                                name="confirmPassword"
                                                value={patientData.confirmPassword}
                                                onChange={handlePatientChange}
                                                required
                                                className="block w-full pl-12 pr-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all duration-200 text-sm shadow-inner"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`mt-6 w-full flex justify-center py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 transform ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Processing...' : 'Register as Patient'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSubmitDoctor} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">First Name</label>
                                        <input type="text" name="firstName" value={doctorData.firstName} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="John" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Last Name</label>
                                        <input type="text" name="lastName" value={doctorData.lastName} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="Doe" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Email</label>
                                        <input type="email" name="email" value={doctorData.email} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="john@example.com" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Phone</label>
                                        <input type="tel" name="phone" value={doctorData.phone} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="+91 9876543210" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Medical Registration No.</label>
                                    <input type="text" name="licenseNumber" value={doctorData.licenseNumber} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="REG12345" />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-1">This will be verified against the Medical Council database.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-3 rounded-2xl bg-surface dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 font-medium">
                                        <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2 truncate">Upload Degree Certificate</label>
                                        <input type="file" name="degreeCertificate" onChange={handleDoctorFileChange} required accept=".pdf,.jpg,.jpeg,.png" className="text-xs text-slate-600 dark:text-slate-400 w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/30 dark:file:text-primary-300" />
                                    </div>
                                    <div className="p-3 rounded-2xl bg-surface dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 font-medium">
                                        <label className="block text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2 truncate">Upload Medical Reg Cert</label>
                                        <input type="file" name="medicalRegCertificate" onChange={handleDoctorFileChange} required accept=".pdf,.jpg,.jpeg,.png" className="text-xs text-slate-600 dark:text-slate-400 w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-900/30 dark:file:text-primary-300" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Password</label>
                                        <input type="password" name="password" value={doctorData.password} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="••••••••" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Confirm Password</label>
                                        <input type="password" name="confirmPassword" value={doctorData.confirmPassword} onChange={handleDoctorChange} required className="block w-full px-4 py-3 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-inner" placeholder="••••••••" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`mt-6 w-full flex justify-center py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-300 transform ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'Processing...' : 'Register and Upload Credentials'}
                                </button>
                            </form>
                        )}

                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700/50 text-center">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Already have an account?{' '}
                                <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500 transition-colors">
                                    Sign In
                                </Link>
                            </p>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div className="text-center animate-fade-in">
                        <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl text-primary-600 dark:text-primary-400">mark_email_read</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Verify OTP</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">{successMsg || 'Enter OTP sent to your email/phone'}</p>

                        <form onSubmit={handleVerifyOTP} className="space-y-5">
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="000000"
                                required
                                className="block w-full text-center text-3xl tracking-widest px-4 py-4 border-none rounded-2xl bg-surface dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 transition-all shadow-inner"
                            />
                            {error && (
                                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm shadow-sm flex justify-center items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">error</span>
                                    {error}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full flex justify-center py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all duration-300 transform ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <div className="flex flex-col gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={handleResendOTP}
                                    disabled={loading}
                                    className="text-sm font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                                >
                                    Resend OTP
                                </button>
                                <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                                    Back to Registration
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {step === 3 && (
                    <div className="text-center animate-fade-in">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl text-emerald-600 dark:text-emerald-400">verified_user</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Account Verified!</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Would you like to set up a passkey for faster, passwordless sign-in?</p>

                        <div className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50 mb-6 flex justify-center gap-6">
                            <div className="flex flex-col items-center text-primary-600 dark:text-primary-400">
                                <span className="material-symbols-outlined text-2xl mb-1">fingerprint</span>
                                <span className="text-xs font-semibold">Touch ID</span>
                            </div>
                            <div className="flex flex-col items-center text-primary-600 dark:text-primary-400">
                                <span className="material-symbols-outlined text-2xl mb-1">face</span>
                                <span className="text-xs font-semibold">Face ID</span>
                            </div>
                            <div className="flex flex-col items-center text-primary-600 dark:text-primary-400">
                                <span className="material-symbols-outlined text-2xl mb-1">pin</span>
                                <span className="text-xs font-semibold">PIN</span>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm shadow-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <button
                                onClick={handlePasskeySetup}
                                disabled={passkeyLoading}
                                className={`w-full flex justify-center items-center gap-2 py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all duration-300 transform ${passkeyLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                <span className="material-symbols-outlined">passkey</span>
                                {passkeyLoading ? 'Setting up...' : 'Set Up Passkey'}
                            </button>
                            <button
                                onClick={() => navigate('/login', { state: { message: 'Registration successful! Please login.' } })}
                                className="w-full text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            >
                                Skip for now
                            </button>
                        </div>
                    </div>
                )}
                {step === 4 && (
                    <div className="text-center animate-fade-in py-10">
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-amber-500/10">
                            <span className="material-symbols-outlined text-4xl text-amber-600 dark:text-amber-400">pending_actions</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-4">Registration Pending</h2>
                        <div className="space-y-4 max-w-sm mx-auto mb-10">
                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                {successMsg || 'Your doctor registration was successful.'}
                            </p>
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400 text-left flex gap-3">
                                <span className="material-symbols-outlined text-primary-500">info</span>
                                <p>Our administrators are currently reviewing your medical credentials. You will receive an email notification once your account is activated.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full flex justify-center py-4 px-4 rounded-lg shadow-sm shadow-primary-500/20 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-all duration-300 transform"
                        >
                            Return to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Register;
