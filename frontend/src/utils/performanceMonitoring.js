import { API_BASE_URL } from '../api/client';

const names = new Set(['LCP', 'INP', 'CLS']);
export async function reportWebVital({ name, value }) {
    if (!names.has(name) || !Number.isFinite(value) || value < 0) return;
    try {
        await fetch(`${API_BASE_URL}/performance`, {
            method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            // Deliberately omit IDs, entries, attribution, URLs and user data.
            body: JSON.stringify({ name, value: Math.round(value * 1000) / 1000 })
        });
    } catch { /* Measurement failures must never interrupt patient workflows. */ }
}
let started = false;
export async function startPerformanceMonitoring() {
    if (started) return;
    started = true;
    const { onCLS, onINP, onLCP } = await import('web-vitals');
    onCLS(reportWebVital);
    onINP(reportWebVital);
    onLCP(reportWebVital);
}
