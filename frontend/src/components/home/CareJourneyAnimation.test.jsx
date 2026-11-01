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
function advanceStep(current, next) {
    advance(2499); expect(phase()).toBe(current);
    advance(1); expect(phase()).toBe(next);
}
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
    expect(screen.queryByLabelText('Explore the care journey')).not.toBeInTheDocument();
    const navigation = screen.getByRole('group', { name: 'Care journey navigation' });
    expect(navigation).toContainElement(screen.getByRole('button', { name: 'Previous care journey step' }));
    expect(navigation).toContainElement(screen.getByRole('button', { name: 'Next care journey step' }));
    expect(screen.queryByRole('button', { name: /pause|play|replay/i })).not.toBeInTheDocument();
    expect(region().querySelector('footer')).toBeNull();
    expect(region().querySelector('.mc-care-count')).toBeNull();
});

test('approval precedes care-team viewing and withdrawal blocks future access without erasing history', () => {
    setup();
    advanceStep('ready', 'choose');
    expect(permission()).toHaveAttribute('aria-checked', 'false');
    advanceStep('choose', 'shared');
    expect(permission()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'View report' })).toBeEnabled();
    expect(region()).toHaveAttribute('data-viewed', 'false');
    advanceStep('shared', 'viewed');
    expect(region()).toHaveAttribute('data-viewed', 'true');
    advanceStep('viewed', 'withdraw');
    advanceStep('withdraw', 'revoked');
    expect(permission()).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Report protected' })).toBeDisabled();
    expect(region()).toHaveAttribute('data-viewed', 'true');
    expect(screen.getByText('Lab report')).toBeVisible();
    advanceStep('revoked', 'ready');
    expect(region()).toHaveAttribute('data-viewed', 'false');
});

test('visitors can take control and revoke access before a report is viewed', () => {
    setup();
    fireEvent.click(permission(), { detail: 1 });
    expect(phase()).toBe('shared');
    expect(region()).toHaveAttribute('data-manual', 'true');
    expect(region()).toHaveAttribute('data-running', 'false');
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

test('pointer navigation wraps in both directions and keeps autoplay running after button focus', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Previous care journey step' });
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.click(button, { detail: 1 });
    expect(phase()).toBe('revoked');
    expect(region()).toHaveAttribute('data-viewed', 'true');
    expect(region()).toHaveAttribute('data-running', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next care journey step' }), { detail: 1 });
    expect(phase()).toBe('ready');
    expect(region()).toHaveAttribute('data-viewed', 'false');
    advanceStep('ready', 'choose');
    fireEvent.click(button, { detail: 1 });
    expect(phase()).toBe('ready');
});

test('manual navigation restarts the full hold instead of inheriting the old timer', () => {
    setup();
    advance(500);
    fireEvent.click(screen.getByRole('button', { name: 'Next care journey step' }), { detail: 1 });
    advanceStep('choose', 'shared');
});

test('pointer focus arriving after navigation does not hold autoplay', () => {
    setup();
    const next = screen.getByRole('button', { name: 'Next care journey step' });
    const focusVisible = vi.spyOn(next, 'matches').mockReturnValue(false);
    fireEvent.click(next, { detail: 1 });
    fireEvent.focus(next);
    expect(focusVisible).toHaveBeenCalledWith(':focus-visible');
    expect(region()).toHaveAttribute('data-running', 'true');
    advanceStep('choose', 'shared');
});

test('keyboard focus alone holds autoplay before a navigation button is activated', () => {
    setup();
    const next = screen.getByRole('button', { name: 'Next care journey step' });
    vi.spyOn(next, 'matches').mockReturnValue(true);
    fireEvent.focus(next);
    expect(region()).toHaveAttribute('data-running', 'false');
    advance(20000); expect(phase()).toBe('ready');
    fireEvent.blur(next, { relatedTarget: document.body });
    advanceStep('ready', 'choose');
});

test('keyboard navigation holds the selected step until focus leaves the illustration', () => {
    setup();
    const next = screen.getByRole('button', { name: 'Next care journey step' });
    const previous = screen.getByRole('button', { name: 'Previous care journey step' });
    vi.spyOn(next, 'matches').mockReturnValue(true);
    vi.spyOn(previous, 'matches').mockReturnValue(true);
    fireEvent.focus(next);
    fireEvent.click(next, { detail: 0 });
    expect(phase()).toBe('choose');
    expect(region()).toHaveAttribute('data-motion', 'false');
    expect(region()).toHaveAttribute('data-running', 'false');
    fireEvent.blur(next, { relatedTarget: previous });
    fireEvent.focus(previous);
    advance(20000); expect(phase()).toBe('choose');
    fireEvent.blur(previous, { relatedTarget: document.body });
    expect(region()).toHaveAttribute('data-running', 'true');
    advanceStep('choose', 'shared');
    expect(region()).toHaveAttribute('data-motion', 'true');
});

test('keyboard interaction pauses a pointer-started sequence even when its button already has focus', () => {
    setup();
    const next = screen.getByRole('button', { name: 'Next care journey step' });
    fireEvent.click(next, { detail: 1 });
    expect(region()).toHaveAttribute('data-running', 'true');
    fireEvent.keyDown(next, { key: 'Tab' });
    advance(20000); expect(phase()).toBe('choose');
    expect(region()).toHaveAttribute('data-running', 'false');
});

test('offscreen and background-tab states stop the timeline and resume without skipping steps', () => {
    setup();
    act(() => intersect([{ isIntersecting: false }]));
    advance(20000); expect(phase()).toBe('ready');
    act(() => intersect([{ isIntersecting: true }]));
    advance(2500); expect(phase()).toBe('choose');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange'));
    advance(20000); expect(phase()).toBe('choose');
});

test('reduced-motion users start paused and can use all sharing controls without motion', () => {
    setup(true);
    expect(screen.getByRole('button', { name: 'Next care journey step' })).toBeEnabled();
    expect(region()).toHaveAttribute('data-motion', 'false');
    advance(20000); expect(phase()).toBe('ready');
    fireEvent.click(permission());
    expect(permission()).toHaveAttribute('aria-checked', 'true');
    expect(region()).toHaveAttribute('data-motion', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Next care journey step' }), { detail: 1 });
    expect(phase()).toBe('viewed');
    expect(region()).toHaveAttribute('data-motion', 'false');
    advance(20000); expect(phase()).toBe('viewed');
});

test('a changed motion preference stops a running sequence', () => {
    setup(); advance(2500);
    act(() => { preference.matches = true; preferenceChanged(); });
    advance(20000); expect(phase()).toBe('choose');
    expect(region()).toHaveAttribute('data-running', 'false');
    expect(region()).toHaveAttribute('data-motion', 'false');
    act(() => { preference.matches = false; preferenceChanged(); });
    advanceStep('choose', 'shared');
});

test('keyboard actions update immediately and stepping into a new loop resets its history', () => {
    setup();
    fireEvent.click(permission(), { detail: 0 });
    expect(region()).toHaveAttribute('data-motion', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'View report' }), { detail: 0 });
    expect(region()).toHaveAttribute('data-viewed', 'true');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Next care journey step' }), { detail: 0 });
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
