import { useCallback, useEffect, useRef, useState } from 'react';
import './BotChallenge.css';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoading;

function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptLoading) return scriptLoading;
    scriptLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        const finish = (error) => {
            clearTimeout(timer);
            script.onload = null;
            script.onerror = null;
            scriptLoading = undefined;
            if (error) { script.remove(); reject(error); }
            else resolve(window.turnstile);
        };
        const timer = setTimeout(() => finish(new Error('Security check timed out.')), 15000);
        script.onload = () => finish(window.turnstile ? null : new Error('Security check unavailable.'));
        script.onerror = () => finish(new Error('Security check could not load.'));
        document.head.appendChild(script);
    });
    return scriptLoading;
}

export function useBotChallenge() {
    const [challenge, setChallenge] = useState(null);
    const [token, setToken] = useState('');
    const [resetKey, setResetKey] = useState(0);
    const reset = useCallback(() => { setToken(''); setResetKey(value => value + 1); }, []);
    const capture = (error) => {
        const config = error.response?.data?.challenge;
        if (![428, 400, 503].includes(error.response?.status) || typeof config?.siteKey !== 'string' || !config.siteKey) return false;
        setChallenge({ siteKey: config.siteKey, action: 'public_auth' });
        setToken('');
        return true;
    };
    return { challenge, token, resetKey, reset, capture, setToken, blocked: Boolean(challenge && !token) };
}

export default function BotChallenge({ challenge, onToken, resetKey }) {
    const container = useRef(null);
    const widget = useRef(null);
    const tokenCallback = useRef(onToken);
    tokenCallback.current = onToken;
    const [attempt, setAttempt] = useState(0);
    const [status, setStatus] = useState('Loading security check…');
    const [failed, setFailed] = useState(false);
    const siteKey = challenge?.siteKey;

    useEffect(() => {
        if (!siteKey) return;
        let active = true;
        let provider;
        setFailed(false);
        setStatus('Loading security check…');
        tokenCallback.current('');
        loadTurnstile().then(api => {
            if (!active) return;
            provider = api;
            widget.current = api.render(container.current, {
                sitekey: siteKey, action: 'public_auth', theme: 'auto', size: 'flexible',
                callback: token => {
                    if (!active) return;
                    tokenCallback.current(token);
                    setStatus('Security check complete. You can continue.');
                    setFailed(false);
                },
                'expired-callback': () => {
                    if (!active) return;
                    tokenCallback.current('');
                    setStatus('Security check expired. Complete it again to continue.');
                    api.reset(widget.current);
                },
                'error-callback': () => {
                    if (!active) return;
                    tokenCallback.current('');
                    setStatus('Security check failed. Please retry.');
                    setFailed(true);
                    return true;
                },
            });
            setStatus('Complete the security check to continue.');
        }).catch(() => {
            if (!active) return;
            tokenCallback.current('');
            setStatus('Security check could not load. Check your connection and retry.');
            setFailed(true);
        });
        return () => {
            active = false;
            tokenCallback.current('');
            if (widget.current !== null && provider) provider.remove(widget.current);
            widget.current = null;
        };
    }, [siteKey, attempt]);

    useEffect(() => {
        if (widget.current === null || !window.turnstile) return;
        tokenCallback.current('');
        window.turnstile.reset(widget.current);
        setStatus('Complete a new security check to continue.');
    }, [resetKey]);

    if (!challenge) return null;
    return <section className="bot-challenge" aria-label="Security check">
        <div ref={container} />
        <p role="status" aria-live="polite">{status}</p>
        {failed && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry security check</button>}
    </section>;
}
