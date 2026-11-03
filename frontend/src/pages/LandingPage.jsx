import React, { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Brand from '../components/common/Brand';
import PublicFooter from '../components/common/PublicFooter';
import PublicWaves from '../components/common/PublicWaves';
import ThemeToggle from '../components/common/ThemeToggle';
import CareJourneyAnimation from '../components/home/CareJourneyAnimation';
import './LandingPage.css';

function Arrow() {
    return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}

function SectionLabel({ children, drawing }) {
    return (
        <p className="mc-home-eyebrow mc-home-section-label">
            <span className="mc-public-tile">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    {drawing}
                </svg>
            </span>
            {children}
        </p>
    );
}

const sectionMarks = {
    patients: <>
        <rect x="4.8" y="3.6" width="14.6" height="17.3" rx="3" fill="var(--mc-border-strong)" stroke="none" transform="rotate(-13 12 12)" />
        <rect x="5" y="3" width="14" height="17.6" rx="3" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" strokeWidth=".65" />
        <circle cx="12" cy="10.2" r="4.5" fill="var(--mc-brand-soft)" stroke="none" />
        <circle cx="12" cy="9" r="1.6" fill="var(--mc-brand)" stroke="none" />
        <path d="M8.9 12.9a3.1 3.1 0 0 1 6.2 0Z" fill="var(--mc-brand)" stroke="none" />
        <path d="M9.5 17h5" stroke="var(--mc-accent)" strokeWidth="1.05" />
        <circle cx="19" cy="17.5" r="3.4" fill="var(--mc-brand)" stroke="var(--mc-surface)" strokeWidth="1.15" />
        <path d="m17.6 17.5 1 1 1.8-2" stroke="var(--mc-on-brand)" strokeWidth=".95" />
    </>,
    sharing: <>
        <rect x="3.3" y="4.1" width="11" height="15.1" rx="2.1" fill="var(--mc-border-strong)" stroke="none" transform="rotate(-12 8.8 11.7)" />
        <path d="M7.4 2.8h5.3l4 4V18a1.8 1.8 0 0 1-1.8 1.8H7.4A1.8 1.8 0 0 1 5.6 18V4.6a1.8 1.8 0 0 1 1.8-1.8Z" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" strokeWidth=".75" />
        <path d="M12.7 3.2v3.7h3.6M8.5 10h4.8m-4.8 2.8H12m-3.5 2.8h2" stroke="var(--mc-accent)" strokeWidth=".9" />
        <path d="M14.3 13.4v-1.1a2.5 2.5 0 0 1 5 0v1.1" stroke="var(--mc-accent)" strokeWidth="1.35" />
        <rect x="12.3" y="13" width="9" height="7.8" rx="2" fill="var(--mc-brand)" stroke="var(--mc-surface)" strokeWidth=".75" />
        <path d="M16.8 16.3v1.8" stroke="var(--mc-on-brand)" strokeWidth="1.25" />
    </>,
    teams: <>
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="var(--mc-accent)" strokeWidth="1.5" />
        <rect x="2.5" y="8.5" width="19" height="12.4" rx="3" fill="var(--mc-border-strong)" stroke="none" />
        <rect x="2.5" y="7" width="19" height="12.4" rx="3" fill="var(--mc-brand)" stroke="none" />
        <path d="M3 11h18" stroke="var(--mc-on-brand)" strokeWidth=".75" opacity=".45" />
        <path d="M7 8.6h10" stroke="var(--mc-on-brand)" strokeWidth=".65" opacity=".5" />
        <rect x="8.4" y="9.9" width="7.2" height="7.2" rx="1.6" fill="var(--mc-on-brand)" stroke="none" />
        <path d="M12 11.8v3.4m-1.7-1.7h3.4" stroke="var(--mc-brand-hover)" strokeWidth="1.25" />
    </>,
};

const privacyFeatures = [
    {
        title: 'Access checks',
        text: 'Medicare checks each care team member’s role and permissions before they can open a record.',
        drawing: <>
            <rect x="4" y="9" width="35" height="25" rx="5" fill="var(--mc-border-strong)" transform="rotate(-11 21 22)" />
            <rect x="4" y="9" width="35" height="25" rx="5" fill="var(--mc-brand-soft)" stroke="var(--mc-border-strong)" />
            <path d="M10 11h22" stroke="var(--mc-surface)" />
            <circle cx="15" cy="18" r="3.5" fill="var(--mc-accent)" />
            <path d="M8.5 28a6.5 6.5 0 0 1 13 0Z" fill="var(--mc-accent)" />
            <path d="M25 15.5h8m-8 5h5" stroke="var(--mc-accent)" />
            <path d="M33 21c3 2.2 6.5 3.4 10 4v6c0 5.5-3.6 9-10 12-6.4-3-10-6.5-10-12v-6c3.5-.6 7-1.8 10-4Z" fill="var(--mc-brand)" stroke="var(--mc-surface)" strokeWidth="2.5" />
            <path d="m28.8 31.6 2.7 2.7 5.8-5.8" stroke="var(--mc-on-brand)" strokeWidth="2.2" />
        </>,
    },
    {
        title: 'Access history',
        text: 'See who opened your records and when.',
        drawing: <>
            <rect x="7" y="8" width="23" height="32" rx="4" fill="var(--mc-brand-soft)" stroke="var(--mc-border-strong)" transform="rotate(-11 18 24)" />
            <path d="M15 5h12l7 7v22a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z" fill="var(--mc-surface)" stroke="var(--mc-accent)" />
            <path d="M27 5v7h7M17 16h10m-10 5h8m-8 5h5" stroke="var(--mc-accent)" />
            <circle cx="33" cy="33" r="10.5" fill="var(--mc-brand)" stroke="var(--mc-surface)" strokeWidth="2" />
            <circle cx="33" cy="33" r="7.5" stroke="var(--mc-on-brand)" strokeWidth=".65" opacity=".55" />
            <path d="M33 27.8V33l3.7 2.3" stroke="var(--mc-on-brand)" strokeWidth="2.2" />
        </>,
    },
    {
        title: 'Sharing control',
        text: 'Choose what to share and withdraw the access you granted.',
        drawing: <>
            <rect x="5" y="9" width="38" height="34" rx="7" fill="var(--mc-border-strong)" />
            <rect x="5" y="5" width="38" height="34" rx="7" fill="var(--mc-brand-soft)" stroke="var(--mc-border-strong)" />
            <path d="M11 7h25" stroke="var(--mc-surface)" />
            <rect x="11" y="12" width="26" height="11" rx="5.5" fill="var(--mc-brand)" />
            <circle cx="31.5" cy="17.5" r="4" fill="var(--mc-on-brand)" />
            <path d="m29.8 17.5 1.2 1.2 2.2-2.4" stroke="var(--mc-brand-hover)" strokeWidth="1.3" />
            <rect x="11" y="27" width="26" height="10" rx="5" fill="var(--mc-surface)" stroke="var(--mc-accent)" />
            <circle cx="16.5" cy="32" r="3.4" fill="var(--mc-accent)" />
            <path d="M15 32h3" stroke="var(--mc-surface)" strokeWidth="1.3" />
        </>,
    },
];

function PrivacyOverview() {
    return (
        <section className="mc-home-trust" id="care-shield" aria-labelledby="privacy-heading" tabIndex={-1}>
            <svg className="mc-home-trust-art" viewBox="0 0 200 132" aria-hidden="true">
                <path d="M82 118C43 117 22 95 16 63c31 5 55 18 66 55Zm37 0c36 0 62-19 69-50-33 1-56 15-69 50Z" fill="var(--mc-brand-soft)" stroke="var(--mc-border-strong)" />
                <path d="M73 120c-31 0-51-10-67-29 29-2 52 7 67 29Zm56 0c26-1 47-9 62-26-27 0-49 9-62 26Z" fill="var(--mc-accent)" opacity=".24" />
                <path d="M100 10c13 9 28 15 47 17v30c0 29-16 48-47 62-31-14-47-33-47-62V27c19-2 34-8 47-17Z" fill="var(--mc-brand)" stroke="var(--mc-surface)" strokeWidth="5" />
                <path d="M100 15c12 8 27 13 42 16v26c0 26-14 43-42 57Z" fill="var(--mc-brand-hover)" />
                <path d="M100 43v34M83 60h34" stroke="var(--mc-on-brand)" strokeWidth="12" strokeLinecap="round" />
            </svg>
            <div className="mc-home-trust-content">
                <p className="mc-home-eyebrow">Medicare privacy</p>
                <h2 id="privacy-heading">Your <em className="mc-care-accent">care</em> shield against unauthorized access.</h2>
                <p>Share with confidence. Medicare checks permissions each time a care team member requests a shared report.</p>
            </div>
            <ul role="list" className="mc-home-trust-items">
                {privacyFeatures.map(({ title, text, drawing }) => (
                    <li key={title}>
                        <div className="mc-home-trust-scene" aria-hidden="true">
                            <svg viewBox="0 0 140 100" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="70" cy="50" r="39" fill="var(--mc-brand-soft)" />
                                <ellipse cx="70" cy="50" rx="54" ry="30" transform="rotate(-17 70 50)" stroke="var(--mc-border-strong)" />
                                <ellipse cx="70" cy="83" rx="28" ry="5" fill="var(--mc-accent)" opacity=".12" />
                                <circle cx="22" cy="61" r="3" fill="var(--mc-accent)" opacity=".65" />
                                <circle cx="116" cy="37" r="2.5" fill="var(--mc-accent)" opacity=".65" />
                                <g transform="translate(32 10) scale(1.58)" strokeWidth="1.1">{drawing}</g>
                            </svg>
                        </div>
                        <h3>{title}</h3>
                        <p>{text}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function LandingPage() {
    const { hash } = useLocation();
    const home = useRef(null);
    useLayoutEffect(() => {
        const section = hash ? document.getElementById(hash.slice(1)) : null;
        (section || home.current)?.scrollIntoView?.();
    }, [hash]);

    return (
        <div ref={home} className="mc-home mc-home-landing">
            <a className="mc-home-skip" href="#main-content">Skip to content</a>
            <header className="mc-home-header mc-home-wrap">
                <Brand />
                <nav aria-label="Main navigation" className="mc-home-nav">
                    <a href="#explore-medicare">For patients</a>
                    <a href="#your-care">How sharing works</a>
                    <a href="#care-teams">For care teams</a>
                </nav>
                <div className="mc-home-account"><Link to="/login">Sign in</Link><ThemeToggle /></div>
            </header>
            <main id="main-content" tabIndex={-1}>
                <section className="mc-home-hero mc-public-tint" aria-labelledby="home-heading">
                    <PublicWaves />
                    <div className="mc-home-wrap mc-home-hero-layout">
                        <div className="mc-home-intro">
                            <SectionLabel drawing={<path d="M12 3c2.5 1.7 5 2.7 7.5 3v5.5c0 4.1-2.6 7.2-7.5 9.5-4.9-2.3-7.5-5.4-7.5-9.5V6c2.5-.3 5-1.3 7.5-3Zm-3 9 2 2 4-4" />}>Medicare portal</SectionLabel>
                            <h1 id="home-heading">Your health records.<br />Protected with <em className="mc-care-accent">care</em>.</h1>
                            <p className="mc-home-lede">With Medicare, you choose what to share with your care team. We check permissions before they can open a shared report, and you can see when it was viewed.</p>
                            <div className="mc-home-hero-actions">
                                <Link className="mc-home-button" to="/register">Create your patient account <Arrow /></Link>
                                <a className="mc-home-outline" href="#your-care">Explore how it works <Arrow /></a>
                            </div>
                        </div>
                        <figure className="mc-home-hero-art">
                            <img src="/images/home/care.webp" alt="A clinician and patient talking through a care plan." width="1000" height="750" fetchPriority="high" />
                        </figure>
                    </div>
                </section>

                <div className="mc-home-wrap">
                    <section className="mc-home-section mc-home-overview mc-home-patients" id="explore-medicare" aria-labelledby="features-heading" tabIndex={-1}>
                        <div className="mc-home-section-intro">
                            <SectionLabel drawing={sectionMarks.patients}>For patients</SectionLabel>
                            <h2 id="features-heading">Keep your <em className="mc-care-accent">care</em> on track.</h2>
                            <p>Go into your next visit with your lab results, prescriptions, and details from past visits within reach.</p>
                            <div className="mc-home-section-action" id="getting-started">
                                <Link className="mc-home-text-link" to="/register">Create your patient account <Arrow /></Link>
                            </div>
                        </div>
                        <div className="mc-home-features">
                            <div>
                                <svg className="mc-home-feature-art" viewBox="52 8 176 128" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="140" cy="72" r="54" fill="var(--mc-brand-soft)" />
                                    <rect x="90" y="25" width="79" height="94" rx="8" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" transform="rotate(-12 130 72)" />
                                    <rect x="111" y="25" width="77" height="94" rx="8" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <rect x="122" y="36" width="24" height="24" rx="6" fill="var(--mc-brand-soft)" />
                                    <path d="M134 42v12m-6-6h12" stroke="var(--mc-accent)" strokeWidth="2" />
                                    <path d="M154 43h19m-19 9h12M123 71h51m-51 10h41m-41 10h28" stroke="var(--mc-border-strong)" strokeWidth="2" />
                                    <circle cx="184" cy="105" r="16" fill="var(--mc-brand)" />
                                    <path d="m178 105 4 4 8-8" stroke="var(--mc-on-brand)" strokeWidth="2" />
                                </svg>
                                <div>
                                    <h3>Medical records</h3>
                                    <p>Pull up a past lab result or check which medication you were prescribed.</p>
                                </div>
                            </div>
                            <div>
                                <svg className="mc-home-feature-art" viewBox="52 8 176 128" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="140" cy="72" r="54" fill="var(--mc-brand-soft)" />
                                    <rect x="88" y="31" width="104" height="87" rx="10" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <path d="M88 55h104" stroke="var(--mc-border-strong)" />
                                    <path d="M113 25v13m54-13v13" stroke="var(--mc-accent)" strokeWidth="4" />
                                    <path d="M106 72h8m22 0h8m22 0h8m-68 15h8m52 0h8m-68 15h8m22 0h8m22 0h8" stroke="var(--mc-border-strong)" strokeWidth="2" />
                                    <rect x="130" y="77" width="20" height="20" rx="6" fill="var(--mc-brand)" />
                                    <path d="m136 87 3 3 5-6" stroke="var(--mc-on-brand)" strokeWidth="2" />
                                </svg>
                                <div>
                                    <h3>Visits</h3>
                                    <p>Check when you’re due back and look up details from your previous visits.</p>
                                </div>
                            </div>
                            <div>
                                <svg className="mc-home-feature-art" viewBox="52 8 176 128" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="140" cy="72" r="54" fill="var(--mc-brand-soft)" />
                                    <rect x="81" y="47" width="118" height="53" rx="12" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <circle cx="106" cy="73" r="15" fill="var(--mc-brand-soft)" />
                                    <path d="M102 72v-3a4 4 0 0 1 8 0v3m-9 0h10v8h-10z" stroke="var(--mc-accent)" strokeWidth="1.5" />
                                    <path d="M130 69h17m-17 9h10" stroke="var(--mc-border-strong)" strokeWidth="2" />
                                    <rect x="158" y="64" width="30" height="18" rx="9" fill="var(--mc-brand)" />
                                    <circle cx="179" cy="73" r="6" fill="var(--mc-on-brand)" />
                                </svg>
                                <div>
                                    <h3>Sharing permissions</h3>
                                    <p>Choose what to share, review who has access, and withdraw permission when you need to.</p>
                                    <a className="mc-home-text-link" href="#your-care">See how sharing works <Arrow /></a>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <section className="mc-home-section mc-home-sharing mc-public-tint" id="your-care" aria-labelledby="sharing-heading" tabIndex={-1}>
                    <div className="mc-home-wrap mc-home-split">
                        <div className="mc-home-section-intro">
                            <SectionLabel drawing={sectionMarks.sharing}>How sharing works</SectionLabel>
                            <h2 id="sharing-heading">Share with <em className="mc-care-accent">care</em>. Stay in control.</h2>
                            <p>Follow a fictional lab report and see what happens when you give someone access to it.</p>
                            <ol className="mc-home-sharing-steps" role="list">
                                <li><span className="mc-public-tile" aria-hidden="true">1</span> Give your care team permission.</li>
                                <li><span className="mc-public-tile" aria-hidden="true">2</span> See what they can open and what gets logged.</li>
                                <li><span className="mc-public-tile" aria-hidden="true">3</span> Withdraw permission to stop future access.</li>
                            </ol>
                        </div>
                        <CareJourneyAnimation />
                    </div>
                </section>

                <div className="mc-home-wrap">
                    <section className="mc-home-section mc-home-overview mc-home-teams" id="care-teams" aria-labelledby="care-teams-heading" tabIndex={-1}>
                        <div className="mc-home-section-intro">
                            <SectionLabel drawing={sectionMarks.teams}>For care teams</SectionLabel>
                            <h2 id="care-teams-heading">Coordinate <em className="mc-care-accent">care</em> with your team.</h2>
                            <p>Pick up where your colleagues left off. Coordinate visits, lab work, and prescriptions using the records you’re authorized to access.</p>
                            <div className="mc-home-section-action">
                                <Link className="mc-home-outline" to="/login">Care team sign in <Arrow /></Link>
                            </div>
                        </div>
                        <div className="mc-home-features">
                            <div>
                                <svg className="mc-home-feature-art" viewBox="52 8 176 128" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="140" cy="72" r="54" fill="var(--mc-brand-soft)" />
                                    <rect x="89" y="31" width="102" height="82" rx="10" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <path d="M89 53h102M123 70h48m-48 21h32" stroke="var(--mc-border-strong)" strokeWidth="2" />
                                    <circle cx="108" cy="70" r="6" fill="var(--mc-brand-soft)" />
                                    <circle cx="108" cy="91" r="6" fill="var(--mc-brand-soft)" />
                                    <circle cx="184" cy="105" r="16" fill="var(--mc-brand)" />
                                    <path d="M184 97v8l5 3" stroke="var(--mc-on-brand)" strokeWidth="2" />
                                </svg>
                                <h3>Visit coordination</h3>
                                <p>Track patient check-ins and visit status.</p>
                            </div>
                            <div>
                                <svg className="mc-home-feature-art" viewBox="52 8 176 128" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="140" cy="72" r="54" fill="var(--mc-brand-soft)" />
                                    <rect x="132" y="28" width="58" height="88" rx="8" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <path d="M143 46h29m-29 10h35m-35 43h28" stroke="var(--mc-border-strong)" strokeWidth="2" />
                                    <path d="M143 83h8l6-12 7 16 5-8h9" stroke="var(--mc-accent)" strokeWidth="2" />
                                    <path d="M100 53h22v49a11 11 0 0 1-22 0z" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <path d="M104 78h14v24a7 7 0 0 1-14 0z" fill="var(--mc-brand-soft)" />
                                    <rect x="97" y="47" width="28" height="9" rx="3" fill="var(--mc-brand)" />
                                </svg>
                                <h3>Lab orders and results</h3>
                                <p>Follow lab orders through to results.</p>
                            </div>
                            <div>
                                <svg className="mc-home-feature-art" viewBox="52 8 176 128" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="140" cy="72" r="54" fill="var(--mc-brand-soft)" />
                                    <rect x="93" y="28" width="76" height="87" rx="9" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                    <path d="M108 46h11m-5.5-5.5v11M108 64h44m-44 10h36m-36 10h22" stroke="var(--mc-accent)" strokeWidth="2" />
                                    <g transform="rotate(-36 174 94)">
                                        <rect x="149" y="83" width="50" height="22" rx="11" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" />
                                        <path d="M174 83h14a11 11 0 0 1 0 22h-14z" fill="var(--mc-brand)" />
                                    </g>
                                </svg>
                                <h3>Prescriptions</h3>
                                <p>Review, prescribe, or dispense as your role allows.</p>
                            </div>
                        </div>
                    </section>
                    <PrivacyOverview />
                </div>
            </main>
            <PublicFooter />
        </div>
    );
}
