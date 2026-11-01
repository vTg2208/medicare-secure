import React from 'react';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import FeatureCarousel from './FeatureCarousel';

let observe;
let motionChange;
function setup(reduce = false) {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: reduce, addEventListener: (_type, callback) => { motionChange = callback; }, removeEventListener: vi.fn() }));
    vi.stubGlobal('IntersectionObserver', class {
        constructor(callback) { observe = callback; }
        observe() {}
        disconnect() {}
    });
    render(<FeatureCarousel />);
}
const advance = () => act(() => vi.advanceTimersByTime(7000));
const slide = number => screen.getByRole('group', { name: new RegExp(`^${number} of 3`) });
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('shows one story at a time, automatically advances, and wraps', () => {
    setup();
    expect(slide(1)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Shared with care. By you.' })).not.toBeInTheDocument();
    advance(); expect(slide(2)).toBeVisible();
    advance(); expect(slide(3)).toBeVisible();
    advance(); expect(slide(1)).toBeVisible();
});

test('manual navigation pauses rotation and supports direct selection and wrapping', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Previous feature' }));
    expect(slide(3)).toBeVisible();
    advance(); expect(slide(3)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show feature 2/ }));
    expect(slide(2)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next feature' }));
    expect(slide(3)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    advance(); expect(slide(1)).toBeVisible();
});

test('pause control stops and restarts the slideshow', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    advance(); expect(slide(1)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    advance(); expect(slide(2)).toBeVisible();
});

test('focusing playback stops rotation, and clicking Pause preserves that intent', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Pause slideshow' });
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.click(button, { detail: 1 });
    advance(); expect(slide(1)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }), { detail: 0 });
    advance(); expect(slide(2)).toBeVisible();
});

test('hover pauses temporarily, while keyboard focus stops until explicit play', () => {
    setup();
    const region = screen.getByRole('region', { name: 'Discover Medicare' });
    fireEvent.mouseEnter(region); advance(); expect(slide(1)).toBeVisible();
    fireEvent.mouseLeave(region); advance(); expect(slide(2)).toBeVisible();
    fireEvent.focus(screen.getByRole('button', { name: 'Next feature' }));
    fireEvent.blur(screen.getByRole('button', { name: 'Next feature' }));
    advance(); expect(slide(2)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
});

test('offscreen and hidden documents suspend automatic updates', () => {
    setup();
    act(() => observe([{ isIntersecting: false }])); advance(); expect(slide(1)).toBeVisible();
    act(() => observe([{ isIntersecting: true }])); advance(); expect(slide(2)).toBeVisible();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fireEvent(document, new Event('visibilitychange')); advance(); expect(slide(2)).toBeVisible();
});

test('reduced motion starts paused and a preference change stops autoplay', () => {
    setup(true); advance(); expect(slide(1)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
    advance(); expect(slide(2)).toBeVisible();
    act(() => motionChange()); advance(); expect(slide(2)).toBeVisible();
});

test('horizontal swipes change features without treating vertical scrolling as navigation', () => {
    setup();
    const region = screen.getByRole('region', { name: 'Discover Medicare' });
    fireEvent.touchStart(region, { changedTouches: [{ clientX: 180, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 80, clientY: 110 }] });
    expect(slide(2)).toBeVisible();
    fireEvent.touchStart(region, { changedTouches: [{ clientX: 180, clientY: 100 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 170, clientY: 210 }] });
    expect(slide(2)).toBeVisible();
});
