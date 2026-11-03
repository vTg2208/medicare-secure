import React, { useEffect, useRef, useState } from 'react';
import './FeatureCarousel.css';

const stories = [
    { title: 'Your history. A clearer picture.', category: '01 / Your health records', image: 'records', alt: 'A patient reviewing an organized medical folder at her desk.', description: 'Records, prescriptions, and reports come together, so your next conversation starts with the whole story.' },
    { title: 'Shared with care. By you.', category: '02 / Consent that puts you first', image: 'sharing', alt: 'A patient and clinician sharing a document across a table.', description: 'Choose who can access your records. Review your permissions and withdraw consent when you need to.' },
    { title: 'Every visit, more connected.', category: '03 / Your care team', image: 'care', alt: 'A clinician and patient talking through a care plan together.', description: 'Help your care team follow the same story, from a consultation to the next step in your treatment.' },
];

export default function FeatureCarousel() {
    const [active, setActive] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const [hovered, setHovered] = useState(false);
    const [visible, setVisible] = useState(true);
    const [onScreen, setOnScreen] = useState(true);
    const [animate, setAnimate] = useState(true);
    const region = useRef(null);
    const touchStart = useRef(null);
    const pointerPlayback = useRef(null);
    const rotating = playing && !hovered && visible && onScreen;

    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => { setReducedMotion(preference.matches); if (preference.matches) setPlaying(false); };
        preference.addEventListener('change', update);
        const visibility = () => setVisible(document.visibilityState !== 'hidden');
        visibility();
        document.addEventListener('visibilitychange', visibility);
        const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 }) : null;
        if (region.current) observer?.observe(region.current);
        return () => { preference.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility); observer?.disconnect(); };
    }, []);

    useEffect(() => {
        if (!rotating) return undefined;
        const timer = window.setTimeout(() => { setAnimate(true); setActive(index => (index + 1) % stories.length); }, 7000);
        return () => window.clearTimeout(timer);
    }, [active, rotating]);

    const select = (index, event) => {
        setPlaying(false);
        setAnimate(event?.detail !== 0);
        setActive((index + stories.length) % stories.length);
    };

    return (
        <section className="mc-feature" aria-label="Discover Medicare" aria-roledescription="carousel" ref={region}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setPlaying(false)}
            onTouchStart={event => { touchStart.current = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }; }}
            onTouchEnd={event => {
                if (!touchStart.current) return;
                const dx = event.changedTouches[0].clientX - touchStart.current.x;
                const dy = event.changedTouches[0].clientY - touchStart.current.y;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) select(active + (dx < 0 ? 1 : -1));
                touchStart.current = null;
            }}>
            <div className="mc-feature-top"><span>The little things, connected.</span><span className="mc-feature-edition">THE MEDICARE WAY</span></div>
            <div className="mc-feature-slides" aria-live={rotating ? 'off' : 'polite'} aria-atomic="true" data-animate={animate && !reducedMotion}>
                {stories.map((story, index) => (
                    <figure key={story.image} className="mc-feature-slide" hidden={active !== index} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${stories.length}: ${story.title}`}>
                        <div className="mc-feature-art"><img src={`/images/home/${story.image}.webp`} alt={story.alt} width="1000" height="750" loading="lazy" decoding="async" /></div>
                        <figcaption><p className="mc-home-eyebrow">{story.category}</p><h2>{story.title}</h2><p>{story.description}</p></figcaption>
                    </figure>
                ))}
            </div>
            <div className="mc-feature-controls">
                <div className="mc-feature-pagination" aria-label="Choose a feature">{stories.map((story, index) => <button key={story.image} aria-label={`Show feature ${index + 1}: ${story.title}`} aria-pressed={active === index} onClick={event => select(index, event)}><span /><span className="sr-only">{index + 1}</span></button>)}</div>
                <div className="mc-feature-navigation">
                    <button className="mc-feature-play"
                        onPointerDown={() => { pointerPlayback.current = playing; }}
                        onClick={event => {
                            // Focus stops rotation; preserve a pointer user's original pause intent.
                            setPlaying(event.detail !== 0 && pointerPlayback.current !== null ? !pointerPlayback.current : !playing);
                            pointerPlayback.current = null;
                        }}
                        aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>{playing ? <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M7 5v10M13 5v10" /></svg> : <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" /></svg>}</button>
                    <span className="mc-feature-count" aria-hidden="true">0{active + 1} <span>/ 03</span></span>
                    <button aria-label="Previous feature" onClick={event => select(active - 1, event)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m12 5-5 5 5 5" /></svg></button>
                    <button aria-label="Next feature" onClick={event => select(active + 1, event)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m8 5 5 5-5 5" /></svg></button>
                </div>
            </div>
        </section>
    );
}
