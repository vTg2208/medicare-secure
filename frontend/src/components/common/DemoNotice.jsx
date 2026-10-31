import React from 'react';
import './DemoNotice.css';

export default function DemoNotice() {
    return (
        <aside className="demo-notice" role="note" aria-label="Free demo">
            <strong className="demo-notice-label">Free demo</strong>
            <p>Synthetic patient data only. Do not enter actual patient information. Uploads, email, and AI are unavailable.</p>
        </aside>
    );
}
