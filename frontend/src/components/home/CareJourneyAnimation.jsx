import React, { useEffect, useRef, useState } from 'react';
import './CareJourneyAnimation.css';

const steps = [
    { id: 'ready', title: 'Your report is ready.', detail: 'Private until you choose to share.', duration: 1300, chapter: 0 },
    { id: 'choose', title: 'You approve access.', detail: 'One clear sharing control.', duration: 650, chapter: 1 },
    { id: 'shared', title: 'Your care team is connected.', detail: 'The right information, shared with permission.', duration: 1250, chapter: 1 },
    { id: 'viewed', title: 'Every access is recorded.', detail: 'Keep a clear history of who viewed your report.', duration: 1600, chapter: 1 },
    { id: 'withdraw', title: 'You can switch it off.', detail: 'Your sharing choices stay flexible.', duration: 650, chapter: 2 },
    { id: 'revoked', title: 'Future access is blocked.', detail: 'Your records and access history stay with you.', duration: 1800, chapter: 2 },
];
const chapters = [{ label: 'Your records', phase: 0 }, { label: 'Share access', phase: 2 }, { label: 'Stay in control', phase: 5 }];

function Icon({ name, ...props }) {
    const paths = {
        document: <><path d="M14 3H5v18h14V8L14 3Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>,
        person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3" /></>,
        clinician: <><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" /></>,
        lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
        unlock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3" /></>,
        check: <path d="m5 12 4 4L19 6" />,
        shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
        arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
        pause: <path d="M9 5v14M15 5v14" />,
        play: <path d="m8 4 12 8-12 8Z" />,
        replay: <><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6" /></>,
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
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
        }, step.duration);
        return () => window.clearTimeout(timer);
    }, [phase, running, step.duration]);

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
                <span className="mc-care-permission-icon"><Icon name={connected ? 'unlock' : 'lock'} /></span>
                <div><strong>Care team access</strong><small>Try the sharing control</small></div>
                <span className="mc-care-permission-state">{connected ? 'Allowed' : 'Private'}</span>
                <button type="button" className="mc-care-switch" role="switch" aria-checked={connected} aria-label="Allow care team access" aria-describedby="mc-care-explainer" onClick={changeAccess}><span /></button>
                <svg className="mc-care-cursor" viewBox="0 0 26 30" aria-hidden="true"><path d="m3 2 20 14-9 2-4 9-7-25Z" /></svg>
            </div>

            <div className="mc-care-scene">
                <article className="mc-care-personal" aria-label="Your private medical records">
                    <div className="mc-care-card-top"><span className="mc-care-avatar"><Icon name="person" /></span><div><strong>You</strong><small>Your health workspace</small></div><Icon name="lock" className="mc-care-small-lock" /></div>
                    <div className="mc-care-report"><span className="mc-care-paper"><Icon name="document" /><span /><span /><span /></span><span className="mc-care-ready"><Icon name="check" />Ready</span><strong>Lab report</strong><small>In your medical records</small></div>
                </article>

                <div className="mc-care-connection" aria-hidden="true"><span className="mc-care-track" /><span className="mc-care-track-active" /><span className="mc-care-packet"><Icon name="document" /></span><Icon name="arrow" className="mc-care-route-arrow" /></div>

                <article className="mc-care-team" aria-label="Care team access">
                    <div className="mc-care-card-top"><span className="mc-care-avatar"><Icon name="clinician" /></span><div><strong>Care team</strong><small>Clinical workspace</small></div></div>
                    <div className="mc-care-access-icon" aria-hidden="true"><span className="mc-care-icon-locked"><Icon name="lock" /></span><span className="mc-care-icon-open"><Icon name="unlock" /></span></div>
                    <strong className="mc-care-team-status">{connected ? (viewed ? 'Report viewed' : 'Access approved') : (phase === 5 ? 'Access withdrawn' : 'Waiting for access')}</strong>
                    <span className="mc-care-team-detail">{connected ? 'Shared with your permission' : (phase === 5 ? 'New requests are blocked' : 'Your permission is needed')}</span>
                    <button className="mc-care-open" disabled={!connected} onClick={event => select(3, event)}><Icon name={connected ? 'document' : 'lock'} />{connected ? 'View report' : 'Report protected'}</button>
                </article>
            </div>

            <div className="mc-care-history" aria-label="Illustrated access history">
                <div><Icon name="shield" /><span className="mc-care-history-label">Access history</span><span className="mc-care-history-private" data-shown={phase < 2} aria-hidden={phase >= 2}>Your report stays private.</span></div>
                <p className="mc-care-history-event" data-shown={phase >= 2} aria-hidden={phase < 2}><Icon name="check" />You approved access</p>
                <p className="mc-care-history-event" data-shown={viewed} aria-hidden={!viewed}><Icon name="check" />Care team viewed your report</p>
                <p className="mc-care-history-event" data-shown={phase === 5} aria-hidden={phase !== 5}><Icon name="lock" />You withdrew future access</p>
            </div>

            <footer className="mc-care-controls">
                <div className="mc-care-chapters" aria-label="Explore the care journey">{chapters.map((chapter, index) => <button key={chapter.label} aria-pressed={index === step.chapter} onClick={event => select(chapter.phase, event)}><span>{index + 1}</span>{chapter.label}</button>)}</div>
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
