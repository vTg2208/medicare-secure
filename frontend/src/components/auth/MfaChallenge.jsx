import React, { useEffect, useId, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { authApi } from '../../api/authApi';
import FlowSteps from '../common/FlowSteps';
import './MfaChallenge.css';

export default function MfaChallenge({ challenge, onComplete, onCancel }) {
    const [phase, setPhase] = useState(challenge.nextStep);
    const [setup, setSetup] = useState(null);
    const [code, setCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const mounted = useRef(true);
    const inputId = useId();
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const perform = async (operation, accept) => {
        if (inFlight.current) return;
        inFlight.current = true; setBusy(true); setError('');
        try {
            const response = await operation();
            if (mounted.current) accept(response.data || response);
        } catch (failure) {
            if (mounted.current) setError(failure.response?.data?.message || failure.message || 'Verification failed. Please try again.');
        } finally {
            inFlight.current = false;
            if (mounted.current) setBusy(false);
        }
    };
    const complete = data => {
        if (!data.user) throw new Error('The server did not confirm your session. Please sign in again.');
        setSetup(null); setRecoveryCodes([]); setCode(''); onComplete(data);
    };
    const submit = event => {
        event.preventDefault();
        if (phase === 'setup') return perform(() => authApi.mfaConfirmSetup(challenge.ticket, code), data => {
            setSetup(null); setCode(''); setRecoveryCodes(data.recoveryCodes); setPhase('acknowledge');
        });
        if (phase === 'recover') return perform(() => authApi.mfaRecover(challenge.ticket, code.trim().toLowerCase()), () => {
            setCode(''); setPhase('enroll');
        });
        return perform(() => authApi.mfaVerify(challenge.ticket, code), complete);
    };
    const recovering = phase === 'recover';
    const restartSetup = () => perform(() => authApi.mfaStartSetup(challenge.ticket), data => {
        setSetup(data); setCode(''); setRecoveryCodes([]); setSaved(false); setPhase('setup');
    });
    return <section className="mfa-challenge" aria-label="Account verification" aria-busy={busy}>
        <FlowSteps label="Sign-in verification progress" steps={['verify', 'recover'].includes(phase)
            ? [{ label: 'Account' }, { label: 'Verify' }] : [{ label: 'Account' }, { label: 'Authenticator' }, { label: 'Recovery codes' }]}
            currentStep={phase === 'acknowledge' ? 2 : 1} />
        <h3>{phase === 'acknowledge' ? 'Save your recovery codes' : phase === 'enroll' || phase === 'setup' ? 'Set up your authenticator' : recovering ? 'Use a recovery code' : 'Verify your sign-in'}</h3>
        {error && <p role="alert" className="mfa-error">{error}</p>}
        {error && ['setup', 'recover', 'acknowledge'].includes(phase) && <>
            <p>If the response was interrupted, resume using this sign-in. This prepares a fresh setup key without spending another recovery code.</p>
            <button type="button" className="mfa-link" disabled={busy} onClick={restartSetup}>Resume authenticator setup</button>
        </>}
        {phase === 'enroll' ? <>
            <p>Add Medicare to an authenticator app on your device. You will save recovery codes before signing in.</p>
            <button className="btn btn-primary" type="button" disabled={busy} onClick={() => perform(() => authApi.mfaStartSetup(challenge.ticket), data => { setSetup(data); setPhase('setup'); })}>
                {busy ? 'Preparing setup…' : 'Start authenticator setup'}
            </button>
        </> : phase === 'acknowledge' ? <>
            <p>Store these codes somewhere safe, separate from your password. Each works once and lets you replace a lost authenticator. These codes are shown once.</p>
            <ul className="mfa-recovery-codes" aria-label="One-time recovery codes">{recoveryCodes.map(value => <li key={value}><code>{value}</code></li>)}</ul>
            <label className="mfa-confirmation"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} disabled={busy} />I saved my recovery codes in a safe place</label>
            <button type="button" className="btn btn-primary" disabled={busy || !saved} onClick={() => perform(() => authApi.mfaAcknowledgeSetup(challenge.ticket), complete)}>
                {busy ? 'Finishing…' : 'Finish secure sign-in'}
            </button>
        </> : <form onSubmit={submit} className="mfa-form">
            {phase === 'setup' && setup ? <>
                <p>Scan this QR code with your authenticator app, or enter the setup key manually.</p>
                <div className="mfa-qr"><QRCodeSVG value={setup.provisioningUri} size={176} title="Authenticator setup QR code" /></div>
                <code aria-label="Manual setup key" className="mfa-setup-key">{setup.secret}</code>
            </> : <p>{recovering ? 'Enter an unused recovery code. You will set up a replacement authenticator before access resumes.' : 'Enter the six-digit code from your authenticator app. If you just used a code, wait for the next one.'}</p>}
            <label htmlFor={inputId}>{recovering ? 'Recovery code' : 'Authenticator code'}</label>
            <input id={inputId} value={code} onChange={event => setCode(event.target.value)} required disabled={busy}
                autoComplete="one-time-code" spellCheck={false} autoCapitalize="none" inputMode={recovering ? 'text' : 'numeric'}
                pattern={recovering ? '[a-fA-F0-9]{8}(-[a-fA-F0-9]{8}){3}' : '[0-9]{6}'} maxLength={recovering ? 35 : 6} />
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Verifying…' : phase === 'setup' ? 'Confirm authenticator' : recovering ? 'Verify recovery code' : 'Verify and sign in'}</button>
            {(phase === 'verify' || recovering) && <button type="button" className="mfa-link" disabled={busy} onClick={() => { setPhase(recovering ? 'verify' : 'recover'); setCode(''); setError(''); }}>
                {recovering ? 'Use my authenticator instead' : 'Use a recovery code'}
            </button>}
        </form>}
        <p className="mfa-expiry">For your security, verification expires after five minutes. Start sign-in again if it expires.</p>
        <button type="button" className="mfa-link" disabled={busy} onClick={() => { setSetup(null); setRecoveryCodes([]); setCode(''); onCancel(); }}>Start sign-in again</button>
    </section>;
}
