import React from 'react';
import { Link } from 'react-router-dom';
import Brand from '../components/common/Brand';
import ThemeToggle from '../components/common/ThemeToggle';
import CareJourneyAnimation from '../components/home/CareJourneyAnimation';
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
                <nav aria-label="Main navigation" className="mc-home-nav"><a href="#getting-started">For patients</a><a href="#care-teams">For care teams</a><a href="#your-care">How it works</a></nav>
                <div className="mc-home-account"><Link to="/login">Log in <Arrow /></Link><ThemeToggle /></div>
            </header>
            <main id="main-content" tabIndex="-1">
                <section className="mc-home-hero" aria-labelledby="home-heading">
                    <div className="mc-home-intro">
                        <p className="mc-home-eyebrow"><span aria-hidden="true" /> Healthcare &amp; patient management</p>
                        <h1 id="home-heading">Your medical records.<br />Your care team.<br /><em>One secure place.</em></h1>
                        <p className="mc-home-lede">Keep reports, prescriptions and visits together. Choose who can access your information.</p>
                        <div className="mc-home-actions"><Link className="mc-home-button" to={entryPath}>{entryLabel}<Arrow /></Link><a className="mc-home-text-link" href="#your-care">See how it works <span aria-hidden="true">↘</span></a></div>
                        <p className="mc-home-small">Already registered? <Link to="/login">Open your patient portal</Link></p>
                        <ul className="mc-home-assurances" aria-label="Your information controls"><li>Role-based access</li><li>Consent controls</li><li>Access history</li></ul>
                    </div>
                    <div id="your-care" className="mc-home-showcase"><CareJourneyAnimation /></div>
                </section>
                <section className="mc-home-journey" id="getting-started" aria-labelledby="journey-heading">
                    <div className="mc-home-section-intro"><p className="mc-home-eyebrow">One connected care journey</p><h2 id="journey-heading">Less searching.<br />More clarity at every step.</h2><p>Start with your visit. Keep the information and the people involved connected.</p></div>
                    <ol className="mc-home-steps">
                        <li><span className="mc-home-step-number">01</span><div><h3>Manage your visits</h3><p>Follow your care from the first request through treatment and follow-up.</p></div></li>
                        <li><span className="mc-home-step-number">02</span><div><h3>Keep records together</h3><p>Find reports, prescriptions and visit history in your patient workspace.</p></div></li>
                        <li><span className="mc-home-step-number">03</span><div><h3>Control who sees them</h3><p>Manage sharing permissions and review the history of access to your information.</p></div></li>
                    </ol>
                </section>
                <section className="mc-home-invitation" id="care-teams" aria-labelledby="invitation-heading"><div><p className="mc-home-eyebrow">For the people caring for you</p><h2 id="invitation-heading">One team.<br />A connected view of care.</h2><p>Doctors, nurses, laboratories and pharmacies follow the care journey with access appropriate to their role.</p></div><Link className="mc-home-button" to="/login">Care team sign in<Arrow /></Link></section>
            </main>
            <footer className="mc-home-footer"><Brand /><p>Your care, with you in control.</p><span>© {new Date().getFullYear()} Medicare</span></footer>
        </div>
    );
}
