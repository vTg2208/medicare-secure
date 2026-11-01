import React from 'react';
import { Link } from 'react-router-dom';
import Brand from '../components/common/Brand';
import ThemeToggle from '../components/common/ThemeToggle';
import CareJourneyAnimation from '../components/home/CareJourneyAnimation';
import FeatureCarousel from '../components/home/FeatureCarousel';
import './LandingPage.css';

function Arrow() {
    return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}

export default function LandingPage() {
    const entryPath = '/register';
    const entryLabel = 'Create patient account';
    return (
        <div className="mc-home">
            <a className="mc-home-skip" href="#main-content">Skip to content</a>
            <header className="mc-home-header">
                <Brand />
                <nav aria-label="Main navigation" className="mc-home-nav"><a href="#getting-started">For patients</a><a href="#explore-medicare">Explore Medicare</a><a href="#care-teams">For care teams</a></nav>
                <div className="mc-home-account"><Link to="/login">Log in <Arrow /></Link><ThemeToggle /></div>
            </header>
            <main id="main-content" tabIndex="-1">
                <section className="mc-home-hero" aria-labelledby="home-heading">
                    <div className="mc-home-intro">
                        <p className="mc-home-eyebrow"><span aria-hidden="true" /> Healthcare &amp; patient management</p>
                        <h1 id="home-heading">Your medical records.<br />Your care team.<br /><em>One secure place.</em></h1>
                        <p className="mc-home-lede">Keep reports, prescriptions and visits together. Choose who can access your information.</p>
                        <div className="mc-home-actions"><Link className="mc-home-button" to={entryPath}>{entryLabel}<Arrow /></Link></div>
                        <p className="mc-home-small">Already registered? <Link to="/login">Open your patient portal</Link></p>
                    </div>
                    <div id="your-care" className="mc-home-showcase"><CareJourneyAnimation /></div>
                </section>
                <section className="mc-home-features" id="explore-medicare" aria-labelledby="features-heading">
                    <div className="mc-home-section-intro"><p className="mc-home-eyebrow">A little clarity. A lot more care.</p><h2 id="features-heading">Your health.<br />Your story.<br /><em>All connected.</em></h2><p>Less searching for records. More focus on you. Medicare brings your health history and care team into one thoughtful space.</p></div>
                    <FeatureCarousel />
                </section>
                <section className="mc-home-journey" id="getting-started" aria-labelledby="journey-heading">
                    <div className="mc-home-section-intro"><p className="mc-home-eyebrow">A simpler way forward</p><h2 id="journey-heading">Care is personal.<br />Getting started should be simple.</h2><p>One place to begin. A clearer picture at every step.</p></div>
                    <ol className="mc-home-steps">
                        <li><span className="mc-home-step-number">01</span><div><h3>Make yourself at home</h3><p>Create your patient account and bring your health profile together.</p></div></li>
                        <li><span className="mc-home-step-number">02</span><div><h3>See the whole picture</h3><p>Find medical records, prescriptions, and visit details without piecing the story together yourself.</p></div></li>
                        <li><span className="mc-home-step-number">03</span><div><h3>Keep care connected</h3><p>Manage consent and give the right care team access to the information they need.</p></div></li>
                    </ol>
                </section>
                <section className="mc-home-invitation" id="care-teams" aria-labelledby="invitation-heading"><div><p className="mc-home-eyebrow">Meet your Medicare</p><h2 id="invitation-heading">A clearer view of your care<br />starts here.</h2><p>Bring your health story together, one step at a time.</p></div><div className="mc-home-entry-actions"><Link className="mc-home-button" to={entryPath}>{entryLabel}<Arrow /></Link><Link className="mc-home-text-link" to="/login">Care team sign in<Arrow /></Link></div></section>
            </main>
            <footer className="mc-home-footer"><Brand /><p>Thoughtfully connected. Centered on you.</p><span>© {new Date().getFullYear()} Medicare</span></footer>
        </div>
    );
}
