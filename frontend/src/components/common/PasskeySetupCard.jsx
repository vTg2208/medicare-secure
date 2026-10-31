import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { authApi } from '../../api/authApi';
import { startRegistration } from '@simplewebauthn/browser';
import './Button.css';

/**
 * PasskeySetupCard - Inline collapsible passkey registration, designed to sit inside a user info bar.
 * Hidden by default, revealed by a toggle button.
 */
function PasskeySetupCard() {
    const { user } = useContext(AuthContext);
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error'
    const [message, setMessage] = useState('');

    if (!user) return null;

    const handleSetupPasskey = async () => {
        setLoading(true);
        setStatus(null);
        setMessage('');

        try {
            const optionsRes = await authApi.passkeyRegisterOptions();
            if (!optionsRes.success) throw new Error(optionsRes.message || 'Failed to get passkey options');

            const credential = await startRegistration({ optionsJSON: optionsRes.data });

            const verifyRes = await authApi.passkeyRegisterVerify(credential, 'My Passkey');
            if (!verifyRes.success) throw new Error(verifyRes.message || 'Passkey registration failed');

            setStatus('success');
            setMessage('Passkey registered! You can now sign in with your fingerprint, face, or PIN.');
        } catch (err) {
            setStatus('error');
            if (err.name === 'NotAllowedError') {
                setMessage('Passkey setup was cancelled.');
            } else {
                setMessage(err.response?.data?.message || err.message || 'Failed to set up passkey');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ borderTop: '1px solid var(--mc-border)', marginTop: '12px', paddingTop: '8px' }}>
            {/* Toggle Button */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: 'var(--mc-accent)',
                    padding: '4px 0',
                    width: '100%',
                }}
            >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Set Up Passkey
                <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', marginLeft: 'auto' }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expandable content */}
            <div style={{
                maxHeight: expanded ? '300px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease, opacity 0.3s ease',
                opacity: expanded ? 1 : 0,
            }}>
                <div style={{ padding: '10px 0 4px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--mc-text-muted)', lineHeight: 1.5 }}>
                        Use fingerprint, face, PIN, or security key to sign in without a password.
                    </p>

                    {/* Auth method icons row */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                        {[
                            {
                                label: 'Fingerprint',
                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                            },
                            {
                                label: 'Face',
                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
                            },
                            {
                                label: 'PIN',
                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                            },
                            {
                                label: 'Key',
                                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--mc-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                            },
                        ].map(m => (
                            <span key={m.label} style={{ fontSize: '11px', color: 'var(--mc-text-muted)', textAlign: 'center' }}>
                                <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '3px' }}>{m.icon}</span>
                                {m.label}
                            </span>
                        ))}
                    </div>

                    {/* Status */}
                    {status === 'success' && (
                        <div style={{ padding: '8px 10px', borderRadius: 'var(--mc-radius-control)', background: 'var(--mc-success-bg)', border: '1px solid var(--mc-success-border)', color: 'var(--mc-success)', fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            {message}
                        </div>
                    )}
                    {status === 'error' && (
                        <div style={{ padding: '8px 10px', borderRadius: 'var(--mc-radius-control)', background: 'var(--mc-danger-bg)', border: '1px solid var(--mc-danger-border)', color: 'var(--mc-danger)', fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            {message}
                        </div>
                    )}

                    {/* Register button */}
                    {status !== 'success' && (
                        <button
                            className="btn btn-primary"
                            onClick={handleSetupPasskey}
                            disabled={loading}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 14px',
                                borderRadius: 'var(--mc-radius-control)',
                                border: 'none',
                                fontFamily: 'var(--mc-font)',
                                color: 'var(--mc-on-brand)',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.7 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading ? 'Setting up...' : '+ Register Passkey'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PasskeySetupCard;
