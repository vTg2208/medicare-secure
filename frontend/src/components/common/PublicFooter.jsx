import React from 'react';
import { Link } from 'react-router-dom';
import Brand from './Brand';
import PublicWaves from './PublicWaves';
import './PublicFooter.css';

const groups = [
    {
        label: 'Medicare',
        drawing: <>
            <path d="M4 6.5c3.3-.8 6.2 0 8 1.5 1.8-1.5 4.7-2.3 8-1.5l1.5 1.8V20c-3.6-.7-7.2-.2-9.5 1.4C9.7 19.8 6.1 19.3 2.5 20V8.3Z" fill="var(--mc-border-strong)" />
            <path d="M3.5 4.9c3.2-.8 6.6-.2 8.5 1.7v13c-2.6-1.6-5.4-2-8.5-1.4Z" fill="var(--mc-brand)" />
            <path d="M12 6.6c1.9-1.9 5.3-2.5 8.5-1.7v13.3c-3.1-.6-5.9-.2-8.5 1.4Z" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" strokeWidth=".65" />
            <path d="M7.8 8.5v4.4m-2.2-2.2H10" stroke="var(--mc-on-brand)" strokeWidth="1.45" />
            <path d="M14.5 9.3c1.1-.5 2.3-.6 3.5-.5m-3.5 3.4c1.1-.5 2.3-.6 3.5-.5m-3.5 3.3 2.5-.5" stroke="var(--mc-accent)" strokeWidth=".95" />
        </>,
        links: [['About Medicare', '/about'], ['Help & support', '/support']],
    },
    {
        label: 'Policies',
        drawing: <>
            <rect x="4" y="3.4" width="12.6" height="16.8" rx="2.2" fill="var(--mc-border-strong)" transform="rotate(-11 10.3 11.8)" />
            <path d="M7.3 2.7h6.4l3.5 3.5v12a1.8 1.8 0 0 1-1.8 1.8H7.3a1.8 1.8 0 0 1-1.8-1.8V4.5a1.8 1.8 0 0 1 1.8-1.8Z" fill="var(--mc-surface)" stroke="var(--mc-border-strong)" strokeWidth=".75" />
            <path d="M13.7 3v3.5h3.2M8.4 9.4h5.1m-5.1 3h3m-3 3h2" stroke="var(--mc-accent)" strokeWidth=".95" />
            <path d="M16.8 10.5c1.6 1.1 3.2 1.7 5 2v3c0 2.8-1.7 4.8-5 6.3-3.3-1.5-5-3.5-5-6.3v-3c1.8-.3 3.4-.9 5-2Z" fill="var(--mc-brand)" stroke="var(--mc-surface)" strokeWidth="1.25" />
            <path d="m14.7 15.8 1.4 1.4 2.9-3" stroke="var(--mc-on-brand)" strokeWidth="1.15" />
        </>,
        links: [['Privacy notice', '/privacy-notice'], ['Accessibility', '/accessibility'], ['Terms of use', '/terms'], ['Cookies', '/cookies']],
    },
];

function FooterArrow() {
    return (
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.5 12h14m-5.5-5.5 5.5 5.5-5.5 5.5" />
        </svg>
    );
}

export default function PublicFooter() {
    return (
        <footer id="site-footer" className="mc-public-footer mc-public-tint">
            <PublicWaves />
            <div className="mc-home-wrap mc-public-footer-layout">
                <div className="mc-public-footer-brand">
                    <Brand />
                    <p>Your health records, shared on your terms. Protected with <em className="mc-care-accent">care</em>.</p>
                    <a className="mc-public-tile mc-public-footer-github" href="https://github.com/vTg2208/medicare-secure" aria-label="Medicare on GitHub">
                        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54l-.02-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.64 1.22 3.29.93.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.62 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.69.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08l-.01 3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
                        </svg>
                    </a>
                </div>
                <nav className="mc-public-footer-nav" aria-label="Footer navigation">
                    {groups.map(({ label, drawing, links }) => (
                        <div key={label}>
                            <h2 className="mc-public-footer-label">
                                <svg aria-hidden="true" width="39" height="39" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">{drawing}</svg>
                                {label}
                            </h2>
                            <ul>
                                {links.map(([text, path]) => (
                                    <li key={path}><Link to={path}>{text}<FooterArrow /></Link></li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>
            </div>
            <div className="mc-public-footer-bottom">
                <p className="mc-home-wrap">© {new Date().getFullYear()} Medicare</p>
            </div>
        </footer>
    );
}
