import React, { useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Brand from '../components/common/Brand';
import PublicFooter from '../components/common/PublicFooter';
import ThemeToggle from '../components/common/ThemeToggle';
import './LandingPage.css';
import './PublicInfoPage.css';

const issuesUrl = 'https://github.com/vTg2208/medicare-secure/issues';

function About() {
    return <>
        <h2>What you can do</h2>
        <p>Find visit details, lab results and prescriptions in one place. Choose what to share with a care team member, review access activity and withdraw sharing permission when you need to.</p>
        <h2>How care teams use Medicare</h2>
        <p>Clinicians and other authorized staff use the workspace to coordinate visits, lab work and prescriptions. Medicare checks what each person is allowed to access when they request a record.</p>
        <h2>Scope of the public environment</h2>
        <p>The public environment is for evaluating these workflows with fictional records. Use it to explore how the platform works. Keep real medical records and identity documents out of it.</p>
        <p><Link to="/#your-care">Explore how sharing works</Link></p>
    </>;
}

function Support() {
    return <>
        <h2>Sign in or verify your email</h2>
        <p><Link to="/login">Sign in</Link> with your account. If you’ve registered and have a verification code, <Link to="/register?verify=1">verify your email</Link>. Check your spam folder if the code hasn’t arrived.</p>
        <h2>Get help with an assigned account</h2>
        <p>Contact the person who gave you access for help signing in. For questions about your health or treatment, contact your healthcare provider directly.</p>
        <h2 id="report-an-issue" tabIndex={-1}>Report a website problem</h2>
        <p>Use the <a href={issuesUrl}>Medicare issue tracker on GitHub</a> to report a website bug or accessibility barrier. Describe the page, what you were trying to do and what happened.</p>
        <p>The tracker is public. Leave out health information, account details, passwords and verification codes. Report suspected security issues privately to the project maintainers through an established contact.</p>
    </>;
}

function Accessibility() {
    return <>
        <h2>Accessibility features</h2>
        <ul>
            <li>The landing page and these information pages use descriptive headings, visible keyboard focus and a link to skip to the main content.</li>
            <li>The landing page sharing walkthrough has manual controls and respects your device’s reduced motion preference.</li>
            <li>You can switch between light and dark appearance.</li>
        </ul>
        <h2>Assessment status</h2>
        <p>These features cover parts of the website. Accessibility across the signed-in workflows has yet to be fully assessed.</p>
        <h2>Report a barrier</h2>
        <p>Follow the steps to <Link to="/support#report-an-issue">report an accessibility issue</Link>. If you can, tell us your browser or assistive technology and what prevented you from completing the task.</p>
    </>;
}

function Terms() {
    return <>
        <h2>Use fictional records in the public environment</h2>
        <p>The public environment is for evaluation. Keep real patient information, identity documents and medical records out of it. Use your healthcare provider’s channels for medical advice or treatment decisions.</p>
        <h2>Use only the access you’re given</h2>
        <p>Use only accounts and records you’re authorized to access. Keep your password and verification codes private. Sign out when you finish, especially on a shared device.</p>
        <h2>Report problems responsibly</h2>
        <p>See <Link to="/support">Help &amp; support</Link> for reporting guidance. Read the <Link to="/privacy-notice">privacy notice</Link> for information about how the operator handles your data.</p>
    </>;
}

function Cookies() {
    return <>
        <h2>Cookies and local storage</h2>
        <p>The Medicare app uses local storage for sign-in and appearance settings. These app features don’t use cookies.</p>
        <dl>
            <dt>Sign-in session</dt>
            <dd>The app saves a session token so you can stay signed in as you move between pages. Signing out removes it from your browser.</dd>
            <dt>Appearance preference</dt>
            <dd>The app remembers your light or dark appearance across visits until you change it or clear the site’s stored data.</dd>
        </dl>
        <h2>Manage your stored data</h2>
        <p>You can clear Medicare’s site data in your browser settings. This removes your saved session and appearance preference. Read the <Link to="/privacy-notice">privacy notice</Link> for more about how your information is handled.</p>
    </>;
}

const infoPages = {
    about: { title: 'About Medicare', intro: 'Medicare is a health records and sharing platform for patients and the teams who care for them.', Content: About },
    support: { title: 'Help & support', intro: 'Find help signing in, verifying your email or reporting a problem with Medicare.', Content: Support },
    accessibility: { title: 'Accessibility statement', intro: 'How to navigate Medicare and tell us about anything that gets in your way.', Content: Accessibility },
    terms: { title: 'Terms of use', intro: 'The rules for using Medicare and protecting the information you can access.', Content: Terms },
    cookies: { title: 'Cookies and browser storage', intro: 'What Medicare saves in your browser and how to clear it.', Content: Cookies },
};

export default function PublicInfoPage({ page }) {
    const { title, intro, Content } = infoPages[page];
    const { hash } = useLocation();
    const root = useRef(null);
    const main = useRef(null);

    useLayoutEffect(() => {
        const section = hash === '#report-an-issue'
            ? main.current.querySelector('#report-an-issue')
            : null;
        (section || main.current).focus({ preventScroll: true });
        (section || root.current).scrollIntoView?.();
    }, [page, hash]);

    return (
        <div ref={root} className="mc-home mc-public-page">
            <title>{`${title} | Medicare`}</title>
            <a className="mc-home-skip" href="#public-main">Skip to content</a>
            <header className="mc-home-wrap mc-public-header">
                <Brand />
                <div className="mc-home-account"><Link to="/login">Sign in</Link><ThemeToggle /></div>
            </header>
            <main ref={main} id="public-main" tabIndex={-1} className="mc-home-wrap mc-public-main">
                <header className="mc-public-heading">
                    <p className="mc-home-eyebrow">Medicare information</p>
                    <h1>{title}</h1>
                    <p>{intro}</p>
                </header>
                <div className="mc-public-content"><Content /></div>
            </main>
            <PublicFooter />
        </div>
    );
}
