import React from 'react';
import { Link } from 'react-router-dom';
import Brand from '../components/common/Brand';
import ThemeToggle from '../components/common/ThemeToggle';
import FeatureCarousel from '../components/home/FeatureCarousel';
import './LandingPage.css';

function Arrow() {
    return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}

export default function LandingPage() {
    const entryPath = '/register';
    const entryLabel = 'Get started';
    return (
        <div className="mc-home">
            <a className="mc-home-skip" href="#main-content">Skip to content</a>
            <header className="mc-home-header">
                <Brand />
                <nav aria-label="Main navigation" className="mc-home-nav"><a href="#your-care">Your care, connected</a><a href="#getting-started">How it works</a></nav>
                <div className="mc-home-account"><Link to="/login">Log in <Arrow /></Link><ThemeToggle /></div>
            </header>
            <main id="main-content" tabIndex="-1">
                <section className="mc-home-hero" aria-labelledby="home-heading">
                    <div className="mc-home-intro">
                        <p className="mc-home-eyebrow"><span aria-hidden="true" /> A little clarity. A lot more care.</p>
                        <h1 id="home-heading">Your health.<br />Your story.<br /><em>All connected.</em></h1>
                        <p className="mc-home-lede">Less searching for records. More focus on you. Medicare brings your health history and care team into one thoughtful space.</p>
                        <div className="mc-home-actions"><Link className="mc-home-button" to={entryPath}>{entryLabel}<Arrow /></Link><a className="mc-home-text-link" href="#your-care">Take a closer look <span aria-hidden="true">↘</span></a></div>
                        <p className="mc-home-small">For patients and the people who care for them.</p>
                        <div className="mc-home-principle"><span className="material-symbols-outlined" aria-hidden="true">person_check</span><p>Your records tell your story.<br /><strong>You decide who gets to see it.</strong></p></div>
                    </div>
                    <div id="your-care" className="mc-home-showcase"><FeatureCarousel /></div>
                </section>
                <section className="mc-home-journey" id="getting-started" aria-labelledby="journey-heading">
                    <div className="mc-home-section-intro"><p className="mc-home-eyebrow">A simpler way forward</p><h2 id="journey-heading">Care is personal.<br />Getting started should be simple.</h2><p>One place to begin. A clearer picture at every step.</p></div>
                    <ol className="mc-home-steps">
                        <li><span className="mc-home-step-number">01</span><div><h3>Make yourself at home</h3><p>Create your patient account and bring your health profile together.</p></div></li>
                        <li><span className="mc-home-step-number">02</span><div><h3>See the whole picture</h3><p>Find medical records, prescriptions, and visit details without piecing the story together yourself.</p></div></li>
                        <li><span className="mc-home-step-number">03</span><div><h3>Keep care connected</h3><p>Manage consent and give the right care team access to the information they need.</p></div></li>
                    </ol>
                </section>
                <section className="mc-home-invitation" aria-labelledby="invitation-heading"><div><p className="mc-home-eyebrow">Meet your Medicare</p><h2 id="invitation-heading">A clearer view of your care<br />starts here.</h2><p>Bring your health story together, one step at a time.</p></div><Link className="mc-home-button" to={entryPath}>{entryLabel}<Arrow /></Link></section>
            </main>
            <footer className="mc-home-footer"><Brand /><p>Thoughtfully connected. Centered on you.</p><span>© {new Date().getFullYear()} Medicare</span></footer>
        </div>
    );
}
