import React, { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { startAuthentication } from '@simplewebauthn/browser';
import ThemeToggle from '../../components/common/ThemeToggle';
import Brand from '../../components/common/Brand';
import './Login.css';

function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('password'); // 'password' or 'passkey'
    const successMessage = location.state?.message;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const navigateByRole = (role) => {
        const r = role?.toUpperCase();
        switch (r) {
            case 'PATIENT': navigate('/patient/dashboard'); break;
            case 'DOCTOR': navigate('/doctor/dashboard'); break;
            case 'ADMIN':
            case 'HOSPITAL_ADMIN':
            case 'SYSTEM_ADMIN': navigate('/admin/dashboard'); break;
            case 'NURSE': navigate('/nurse/dashboard'); break;
            case 'LAB_TECHNICIAN': navigate('/dashboard/lab'); break;
            case 'RADIOLOGIST': navigate('/radiology/dashboard'); break;
            case 'PHARMACIST': navigate('/pharmacist/dashboard'); break;
            case 'COMPLIANCE_OFFICER':
            case 'COMPLIANCE': navigate('/compliance/dashboard'); break;
            case 'INSURANCE':
            case 'INSURANCE_PROVIDER': navigate('/insurance/dashboard'); break;
            case 'RESEARCHER': navigate('/researcher/dashboard'); break;
            default: navigate('/staff/dashboard');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login(formData.email, formData.password);

            const payload = response.data || response;
            const user = payload.user || payload.data?.user;
            const accessToken = payload.accessToken || payload.token || payload.data?.accessToken;

            if (!user || !accessToken) {
                throw new Error('Invalid server response: Missing user/token');
            }

            login(user, accessToken);
            navigateByRole(user.role || user.roleName);
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.message?.includes('not verified')) {
                setError('Your account is awaiting verification. Patients can choose Verify email below and enter the code sent to them.');
            } else {
                const errorMsg = err.response?.data?.message || err.message || 'Login failed';
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        if (!formData.email) {
            setError('Please enter your email or phone first');
            return;
        }

        setError('');
        setPasskeyLoading(true);

        try {
            // Step 1: Get authentication options from server
            const optionsRes = await authApi.passkeyLoginOptions(formData.email);
            if (!optionsRes.success) {
                throw new Error(optionsRes.message || 'Failed to get passkey options');
            }

            // Step 2: Trigger browser's WebAuthn prompt (fingerprint, face, PIN, etc.)
            const credential = await startAuthentication({ optionsJSON: optionsRes.data });

            // Step 3: Verify with server
            const verifyRes = await authApi.passkeyLoginVerify(formData.email, credential);

            const payload = verifyRes.data || verifyRes;
            const user = payload.user || payload.data?.user;
            const accessToken = payload.accessToken || payload.token || payload.data?.accessToken;

            if (!user || !accessToken) {
                throw new Error('Invalid server response');
            }

            login(user, accessToken);
            navigateByRole(user.role || user.roleName);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Passkey authentication was cancelled');
            } else {
                const errorMsg = err.response?.data?.message || err.message || 'Passkey login failed';
                setError(errorMsg);
            }
        } finally {
            setPasskeyLoading(false);
        }
    };

    const busy = loading || passkeyLoading;

    return (
        <main className="medicare-login">
            <section className="login-story" aria-label="About Medicare">
                <Brand className="login-brand" />
                <div className="login-story-content">
                    <p className="login-eyebrow">Your connected care space</p>
                    <h1>Better care.<br /><span>Closer together.</span></h1>
                    <p className="login-story-description">One place for your health records, care team, and the decisions that matter to you.</p>
                    <div className="login-care-visual" aria-label="Records, visits, and sharing in one place">
                        <div className="login-care-header"><img src="/medicare-icon.svg" alt="" width="40" height="40" /><div>Care, connected.<small>Built around you</small></div></div>
                        <div className="login-care-rule" />
                        {[['description', 'Your health records'], ['calendar_month', 'Your upcoming visits'], ['shield', 'Your sharing preferences']].map(([icon, text]) => (
                            <div className="login-care-item" key={icon}><span className="material-symbols-outlined" aria-hidden="true">{icon}</span><span>{text}</span><span className="material-symbols-outlined" aria-hidden="true">check_circle</span></div>
                        ))}
                    </div>
                    <p className="login-story-foot">For patients. For care teams.<br />For a more connected healthcare experience.</p>
                </div>
            </section>
            <section className="login-form-side" aria-label="Sign in">
                <div className="login-topbar">
                    <Link to="/" className="login-back"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>Back to home</Link>
                    <ThemeToggle />
                </div>
                <div className="login-form-content">
                    <Brand className="login-brand login-mobile-brand" />
                    <div className="login-form-heading"><h2>Welcome back</h2><p>Sign in to your Medicare account.</p></div>
                    {successMessage && <div role="status" className="login-notice login-success">{successMessage}</div>}
                    {error && <div id="login-error" role="alert" className="login-notice login-error">{error}</div>}
                    <div className="login-methods" role="group" aria-label="Sign-in method">
                        <button type="button" disabled={busy} aria-pressed={activeTab === 'password'} onClick={() => { setActiveTab('password'); setError(''); }}>Password</button>
                        <button type="button" disabled={busy} aria-pressed={activeTab === 'passkey'} onClick={() => { setActiveTab('passkey'); setError(''); }}><span className="material-symbols-outlined" aria-hidden="true">fingerprint</span>Passkey</button>
                    </div>
                    {activeTab === 'password' ? (
                        <form onSubmit={handleSubmit} className="login-fields" aria-busy={loading}>
                            <div className="login-field">
                                <label htmlFor="login-email">Email or phone</label>
                                <input id="login-email" type="text" name="email" value={formData.email} onChange={handleChange} autoComplete="username" autoCapitalize="none" spellCheck={false} required disabled={busy} aria-describedby={error ? 'login-error' : undefined} placeholder="Enter your email or phone" />
                            </div>
                            <div className="login-field">
                                <label htmlFor="login-password">Password</label>
                                <div className="login-input-wrap">
                                    <input id="login-password" type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} autoComplete="current-password" required disabled={busy} aria-describedby={error ? 'login-error' : undefined} placeholder="Enter your password" />
                                    <button type="button" className="login-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><span className="material-symbols-outlined" aria-hidden="true">{showPassword ? 'visibility_off' : 'visibility'}</span></button>
                                </div>
                            </div>
                            <button type="submit" className="login-submit" disabled={busy}>{loading ? 'Signing in…' : 'Sign in'}<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span></button>
                        </form>
                    ) : (
                        <form className="login-fields" aria-busy={passkeyLoading} onSubmit={(e) => { e.preventDefault(); handlePasskeyLogin(); }}>
                            <p className="login-passkey-help">Use a passkey already linked to your account. Your device may ask for your fingerprint, face, or PIN.</p>
                            <div className="login-field">
                                <label htmlFor="passkey-email">Email or phone</label>
                                <input id="passkey-email" type="text" name="email" value={formData.email} onChange={handleChange} autoComplete="username webauthn" autoCapitalize="none" spellCheck={false} required disabled={busy} placeholder="Enter your email or phone" aria-describedby={error ? 'login-error' : undefined} />
                            </div>
                            <button type="submit" className="login-submit" disabled={busy}>{passkeyLoading ? 'Authenticating…' : 'Sign in with passkey'}<span className="material-symbols-outlined" aria-hidden="true">fingerprint</span></button>
                        </form>
                    )}
                    <p className="login-access-note"><span className="material-symbols-outlined" aria-hidden="true">lock</span>Your records are available according to your role and sharing permissions.</p>
                    <p className="login-signup">New to Medicare? <Link to="/register">Create a patient account</Link></p>
                    <p className="login-signup"><Link to="/register?verify=1">Verify email</Link></p>
                    <p className="login-signup"><Link to="/privacy-notice">Read privacy notice</Link></p>
                    <p className="login-signup"><Link to="/support">Get help signing in</Link></p>
                </div>
                <footer className="login-footer">© {new Date().getFullYear()} Medicare. Your care, connected.</footer>
            </section>
        </main>
    );
}

export default Login;
