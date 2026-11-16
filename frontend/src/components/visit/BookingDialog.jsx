import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './BookingDialog.css';

export default function BookingDialog({ labelledBy, onDismiss, returnFocusRef, children, wide = false }) {
    const dialog = useRef(null);
    const dismiss = useRef(onDismiss);
    dismiss.current = onDismiss;
    useEffect(() => {
        const panel = dialog.current;
        const opener = returnFocusRef?.current || document.activeElement;
        const backdrop = panel.parentElement;
        const previous = [...document.body.children].filter(element => element !== backdrop).map(element => ({ element, inert: element.inert, hidden: element.getAttribute('aria-hidden') }));
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusable = () => [...panel.querySelectorAll('*')].filter(element => element.matches('button, input, select, textarea, a[href], [tabindex="0"]') && !element.matches(':disabled') && !element.closest('[hidden]'));
        const focusFirst = () => (focusable()[0] || panel).focus();
        focusFirst();
        previous.forEach(({ element }) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
        const keydown = event => {
            if (event.key === 'Escape') { event.preventDefault(); dismiss.current(); }
            if (event.key !== 'Tab') return;
            const items = focusable();
            const first = items[0];
            const last = items[items.length - 1];
            if (!first) { event.preventDefault(); panel.focus(); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        const focusin = event => { if (!panel.contains(event.target)) focusFirst(); };
        document.addEventListener('keydown', keydown);
        document.addEventListener('focusin', focusin);
        return () => {
            document.removeEventListener('keydown', keydown);
            document.removeEventListener('focusin', focusin);
            document.body.style.overflow = overflow;
            previous.forEach(({ element, inert, hidden }) => {
                element.inert = inert;
                if (hidden === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', hidden);
            });
            if (opener?.isConnected) opener.focus();
        };
    }, [returnFocusRef]);
    return createPortal(<div className="mc-booking-backdrop">
        <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} className={`mc-booking-dialog${wide ? ' mc-booking-dialog-wide' : ''}`}>
            {children}
        </section>
    </div>, document.body);
}
