import React, { useEffect, useRef, useState } from 'react';
import './CareJourneyAnimation.css';

const STEP_DURATION_MS = 1000;
const steps = [
    { id: 'ready', title: 'Your report is ready.', detail: 'Private until you choose to share.' },
    { id: 'choose', title: 'You approve access.', detail: 'One clear sharing control.' },
    { id: 'shared', title: 'Your care team is connected.', detail: 'The right information, shared with permission.' },
    { id: 'viewed', title: 'Every access is recorded.', detail: 'Keep a clear history of who viewed your report.' },
    { id: 'withdraw', title: 'You can switch it off.', detail: 'Your sharing choices stay flexible.' },
    { id: 'revoked', title: 'Future access is blocked.', detail: 'Your records and access history stay with you.' },
];

function Icon({ name, ...props }) {
    const paths = {
        document: <><path d="M14 3H5v18h14V8L14 3Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>,
        person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3" /></>,
        clinician: <><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" /></>,
        check: <path d="m5 12 4 4L19 6" />,
        shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
        pause: <path d="M9 5v14M15 5v14" />,
        play: <path d="m8 4 12 8-12 8Z" />,
        replay: <><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function MovingLock({ className = '' }) {
    return <svg className={`mc-care-moving-lock ${className}`} viewBox="0 0 32 40" fill="none" aria-hidden="true">
        <g className="mc-care-shackle-lift"><g className="mc-care-shackle"><path d="M8 19V11a8 8 0 0 1 16 0v16" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></g></g>
        <rect x="3" y="17" width="26" height="21" rx="6" fill="currentColor" />
        <path d="M16 25v5" stroke="var(--mc-surface)" strokeWidth="3" strokeLinecap="round" />
    </svg>;
}

function SharingPath() {
    return <svg className="mc-care-sharing-path" viewBox="0 0 64 80" fill="none" aria-hidden="true">
        <rect className="mc-care-route-channel" x="0" y="28" width="64" height="24" rx="12" />
        <path className="mc-care-route-leads" d="M1 40H15M49 40H63" />
        <circle className="mc-care-route-hub" cx="32" cy="40" r="17" />
        <path className="mc-care-route-symbol" d="M24 36h15m-4-4 4 4-4 4M40 44H25m4-4-4 4 4 4" />
    </svg>;
}

export default function CareJourneyAnimation() {
    const region = useRef(null);
    const playbackIntent = useRef(null);
    const [phase, setPhase] = useState(0);
    const [viewed, setViewed] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
    const [onScreen, setOnScreen] = useState(false);
    const [animate, setAnimate] = useState(true);
    const [manualInteraction, setManualInteraction] = useState(false);
    const step = steps[phase];
    const connected = phase >= 2 && phase <= 4;
    const running = playing && visible && onScreen && !reducedMotion;

    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updatePreference = () => {
            setReducedMotion(preference.matches);
            if (preference.matches) setPlaying(false);
        };
        const updateVisibility = () => setVisible(document.visibilityState !== 'hidden');
        preference.addEventListener('change', updatePreference);
        document.addEventListener('visibilitychange', updateVisibility);
        const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.2 });
        if (observer && region.current) observer.observe(region.current);
        if (!observer) setOnScreen(true);
        return () => {
            preference.removeEventListener('change', updatePreference);
            document.removeEventListener('visibilitychange', updateVisibility);
            observer?.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!running) return undefined;
        const timer = window.setTimeout(() => {
            const next = (phase + 1) % steps.length;
            setAnimate(true);
            setManualInteraction(false);
            setPhase(next);
            if (next === 0) setViewed(false);
            if (next === 3) setViewed(true);
        }, STEP_DURATION_MS);
        return () => window.clearTimeout(timer);
    }, [phase, running]);

    function select(next, event) {
        setPlaying(false);
        setAnimate(event.detail !== 0);
        setManualInteraction(true);
        setPhase(next);
        setViewed(next >= 3);
    }

    function changeAccess(event) {
        setPlaying(false);
        setAnimate(event.detail !== 0);
        setManualInteraction(true);
        setPhase(connected ? 5 : 2);
        if (!connected) setViewed(false);
    }

    function togglePlayback(event) {
        const previous = event.detail !== 0 && playbackIntent.current !== null ? playbackIntent.current : playing;
        playbackIntent.current = null;
        setManualInteraction(false);
        setPlaying(!previous);
    }

    return (
        <section className="mc-care-journey" aria-label="See how Medicare sharing works" ref={region}
            data-phase={step.id} data-connected={connected} data-viewed={viewed}
            data-running={running} data-motion={animate && !reducedMotion} data-manual={manualInteraction}
            onFocusCapture={() => setPlaying(false)}>
            <header className="mc-care-heading">
                <span className="mc-care-kicker"><span />A connected care journey<span className="mc-care-count" aria-hidden="true">0{phase + 1}<span>/ 06</span></span></span>
                <div className="mc-care-caption" aria-live={running ? 'off' : 'polite'} aria-atomic="true">
                    <h2>{step.title}</h2><p>{step.detail}</p>
                </div>
            </header>

            <div className="mc-care-permission">
                <div><strong>Care team access</strong><small>Try the sharing control</small></div>
                <span className="mc-care-permission-state">{connected ? 'Allowed' : 'Private'}</span>
                <button type="button" className="mc-care-switch" role="switch" aria-checked={connected} aria-label="Allow care team access" aria-describedby="mc-care-explainer" onClick={changeAccess}><span /></button>
                <svg className="mc-care-cursor" viewBox="0 0 26 30" aria-hidden="true"><path d="m3 2 20 14-9 2-4 9-7-25Z" /></svg>
            </div>

            <div className="mc-care-scene">
                <article className="mc-care-personal" aria-label="Your private medical records">
                    <div className="mc-care-card-top"><span className="mc-care-avatar"><Icon name="person" /></span><div><strong>You</strong><small>Your health workspace</small></div></div>
                    <div className="mc-care-report"><span className="mc-care-paper"><Icon name="document" /><span /><span /><span /><MovingLock className="mc-care-report-lock" /></span><span className="mc-care-ready"><Icon name="check" />Ready</span><strong>Lab report</strong><small>In your medical records</small></div>
                </article>

                <div className="mc-care-connection" aria-hidden="true"><SharingPath /></div>

                <article className="mc-care-team" aria-label="Care team access">
                    <div className="mc-care-card-top"><span className="mc-care-avatar"><Icon name="clinician" /></span><div><strong>Care team</strong><small>Clinical workspace</small></div></div>
                    <div className="mc-care-team-content">
                        <div className="mc-care-access-icon" aria-hidden="true"><span className="mc-care-received-report"><Icon name="document" /></span></div>
                        <strong className="mc-care-team-status">{connected ? (viewed ? 'Report viewed' : 'Access approved') : (phase === 5 ? 'Access withdrawn' : 'Waiting for access')}</strong>
                        <span className="mc-care-team-detail">{connected ? 'Shared with your permission' : (phase === 5 ? 'New requests are blocked' : 'Your permission is needed')}</span>
                        <button className="mc-care-open" disabled={!connected} onClick={event => select(3, event)}><Icon name="document" />{connected ? 'View report' : 'Report protected'}</button>
                    </div>
                </article>
                <span className="mc-care-flying-report" aria-hidden="true"><Icon name="document" /><span /><span /><span /></span>
            </div>

            <div className="mc-care-history" aria-label="Illustrated access history">
                <div><Icon name="shield" /><span className="mc-care-history-label">Access history</span><span className="mc-care-history-private" data-shown={phase < 2} aria-hidden={phase >= 2}>Your report stays private.</span></div>
                <p className="mc-care-history-event" data-shown={phase >= 2} aria-hidden={phase < 2}><Icon name="check" />You approved access</p>
                <p className="mc-care-history-event" data-shown={viewed} aria-hidden={!viewed}><Icon name="check" />Care team viewed your report</p>
                <p className="mc-care-history-event" data-shown={phase === 5} aria-hidden={phase !== 5}><Icon name="check" />You withdrew future access</p>
            </div>

            <footer className="mc-care-controls">
                <div className="mc-care-playback"><button className="mc-care-play" disabled={reducedMotion}
                    onPointerDown={() => { playbackIntent.current = playing; }} onClick={togglePlayback}
                    aria-label={reducedMotion ? 'Automatic animation disabled for reduced motion' : playing ? 'Pause animation' : 'Play animation'}><Icon name={playing && !reducedMotion ? 'pause' : 'play'} /><span>{reducedMotion ? 'Motion reduced' : playing ? 'Pause' : 'Play'}</span></button>
                    <button aria-label="Replay care journey" onClick={event => { select(0, event); setPlaying(!reducedMotion); }}><Icon name="replay" /></button>
                </div>
            </footer>
            <p id="mc-care-explainer" className="mc-care-sr-only">Interactive illustration of sharing controls. These controls do not change your account permissions. Withdrawing consent blocks future access; it does not recall information already received.</p>
        </section>
    );
}
