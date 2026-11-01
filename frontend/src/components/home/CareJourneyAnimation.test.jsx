import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import CareJourneyAnimation from './CareJourneyAnimation';

let intersect;
let preference;
let preferenceChanged;
const advance = milliseconds => act(() => vi.advanceTimersByTime(milliseconds));
const region = () => screen.getByRole('region', { name: 'See how Medicare sharing works' });
const permission = () => screen.getByRole('switch', { name: 'Allow care team access' });
const phase = () => region().getAttribute('data-phase');
const scene = () => render(<CareJourneyAnimation />);
function setup(reduce = false) {
    preference = { matches: reduce, addEventListener: (_name, callback) => { preferenceChanged = callback; }, removeEventListener: vi.fn() };
    vi.spyOn(window, 'matchMedia').mockReturnValue(preference);
    vi.stubGlobal('IntersectionObserver', class {
        constructor(callback) { intersect = callback; }
        observe() {}
        disconnect() {}
    });
    scene();
    act(() => intersect([{ isIntersecting: true }]));
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('shows an immediately understandable private record before the animation advances', () => {
    setup();
    expect(screen.getByText('Lab report')).toBeVisible();
    expect(permission()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Report protected' })).toBeDisabled();
    expect(phase()).toBe('ready');
});

test('approval precedes care-team viewing and withdrawal blocks future access without erasing history', () => {
    setup();
    advance(1300); expect(phase()).toBe('choose');
    expect(permission()).toHaveAttribute('aria-checked', 'false');
    advance(650); expect(phase()).toBe('shared');
    expect(permission()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'View report' })).toBeEnabled();
    expect(region()).toHaveAttribute('data-viewed', 'false');
    advance(1550); expect(phase()).toBe('viewed');
    expect(region()).toHaveAttribute('data-viewed', 'true');
    advance(1300); expect(phase()).toBe('withdraw');
    advance(650); expect(phase()).toBe('revoked');
    expect(permission()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Report protected' })).toBeDisabled();
    expect(region()).toHaveAttribute('data-viewed', 'true');
    expect(screen.getByText('Lab report')).toBeVisible();
    advance(1800); expect(phase()).toBe('ready');
    expect(region()).toHaveAttribute('data-viewed', 'false');
});

test('visitors can take control and revoke access before a report is viewed', () => {
    setup();
    fireEvent.click(permission(), { detail: 1 });
    expect(phase()).toBe('shared');
    expect(region()).toHaveAttribute('data-manual', 'true');
    expect(screen.getByRole('button', { name: 'Play animation' })).toBeEnabled();
    advance(20000); expect(phase()).toBe('shared');
    fireEvent.click(permission(), { detail: 1 });
    expect(phase()).toBe('revoked');
    expect(region()).toHaveAttribute('data-viewed', 'false');
    expect(screen.getByRole('button', { name: 'Report protected' })).toBeDisabled();
});

test('the illustrated care team can open only a shared report', () => {
    setup();
    fireEvent.click(permission(), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'View report' }), { detail: 1 });
    expect(phase()).toBe('viewed');
    expect(region()).toHaveAttribute('data-viewed', 'true');
    fireEvent.click(permission(), { detail: 1 });
    expect(region()).toHaveAttribute('data-viewed', 'true');
    expect(screen.getByRole('button', { name: 'Report protected' })).toBeDisabled();
});

test('access history exposes only events that have happened to assistive technology', () => {
    setup();
    const viewedEvent = screen.getByText('Care team viewed your report').closest('p');
    const withdrawalEvent = screen.getByText('You withdrew future access').closest('p');
    expect(viewedEvent).toHaveAttribute('aria-hidden', 'true');
    expect(withdrawalEvent).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(permission());
    expect(viewedEvent).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'View report' }));
    expect(viewedEvent).toHaveAttribute('aria-hidden', 'false');
    fireEvent.click(permission());
    expect(viewedEvent).toHaveAttribute('aria-hidden', 'false');
    expect(withdrawalEvent).toHaveAttribute('aria-hidden', 'false');
});

test('a pointer pause retains pause intent when focus first stops automatic playback', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Pause animation' });
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.click(button, { detail: 1 });
    expect(screen.getByRole('button', { name: 'Play animation' })).toBeEnabled();
    advance(20000); expect(phase()).toBe('ready');
    fireEvent.click(screen.getByRole('button', { name: 'Play animation' }));
    advance(1300); expect(phase()).toBe('choose');
});

test('offscreen and background-tab states stop the timeline and resume without skipping steps', () => {
    setup();
    act(() => intersect([{ isIntersecting: false }]));
    advance(20000); expect(phase()).toBe('ready');
    act(() => intersect([{ isIntersecting: true }]));
    advance(1300); expect(phase()).toBe('choose');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    advance(20000); expect(phase()).toBe('choose');
});

test('reduced-motion users start paused and can use all sharing controls without motion', () => {
    setup(true);
    expect(screen.getByRole('button', { name: 'Automatic animation disabled for reduced motion' })).toBeDisabled();
    expect(region()).toHaveAttribute('data-motion', 'false');
    advance(20000); expect(phase()).toBe('ready');
    fireEvent.click(permission());
    expect(permission()).toHaveAttribute('aria-checked', 'true');
    expect(region()).toHaveAttribute('data-motion', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Replay care journey' }));
    advance(20000); expect(phase()).toBe('ready');
});

test('a changed motion preference stops a running sequence', () => {
    setup(); advance(1300);
    act(() => { preference.matches = true; preferenceChanged(); });
    advance(20000); expect(phase()).toBe('choose');
    expect(region()).toHaveAttribute('data-running', 'false');
    expect(region()).toHaveAttribute('data-motion', 'false');
});

test('keyboard actions update the illustration immediately and replay resets its history', () => {
    setup();
    fireEvent.click(permission(), { detail: 0 });
    expect(region()).toHaveAttribute('data-motion', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'View report' }), { detail: 0 });
    expect(region()).toHaveAttribute('data-viewed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Replay care journey' }), { detail: 0 });
    expect(phase()).toBe('ready');
    expect(region()).toHaveAttribute('data-viewed', 'false');
    expect(region()).toHaveAttribute('data-motion', 'false');
});

test('removes the automatic timer when the illustration unmounts', () => {
    setup();
    expect(vi.getTimerCount()).toBe(1);
    cleanup();
    expect(vi.getTimerCount()).toBe(0);
});
