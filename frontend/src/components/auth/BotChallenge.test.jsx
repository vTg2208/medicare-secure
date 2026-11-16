import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BotChallenge from './BotChallenge';

const challenge = { siteKey: 'public-site-key', action: 'public_auth' };
afterEach(() => { delete window.turnstile; document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach(script => script.remove()); });

test('loads one fixed provider script, recovers from load failure, and cleans up the widget', async () => {
    const onToken = vi.fn();
    const view = render(<BotChallenge challenge={challenge} onToken={onToken} resetKey={0} />);
    const script = document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]');
    expect(script).not.toBeNull();
    fireEvent.error(script);
    expect(await screen.findByRole('button', { name: 'Retry security check' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry security check' }));
    const retryScript = document.querySelector('script[src*="challenges.cloudflare.com"]');
    expect(retryScript).not.toBe(script);
    expect(document.querySelectorAll('script[src*="challenges.cloudflare.com"]')).toHaveLength(1);
    let options;
    window.turnstile = { render: vi.fn((element, config) => { options = config; return 'widget'; }), remove: vi.fn(), reset: vi.fn() };
    fireEvent.load(retryScript);
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    expect(options).toMatchObject({ sitekey: 'public-site-key', action: 'public_auth', theme: 'auto', size: 'flexible' });
    act(() => options.callback('token'));
    expect(onToken).toHaveBeenLastCalledWith('token');
    view.rerender(<BotChallenge challenge={challenge} onToken={onToken} resetKey={1} />);
    expect(onToken).toHaveBeenLastCalledWith('');
    expect(window.turnstile.reset).toHaveBeenCalledWith('widget');
    act(() => options['error-callback']());
    expect(onToken).toHaveBeenLastCalledWith('');
    fireEvent.click(screen.getByRole('button', { name: 'Retry security check' }));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(2));
    expect(window.turnstile.remove).toHaveBeenCalledWith('widget');
    view.unmount();
    expect(window.turnstile.remove).toHaveBeenCalledTimes(2);
});

test('shares a pending script and does not render a widget after unmount', async () => {
    const first = render(<BotChallenge challenge={challenge} onToken={vi.fn()} resetKey={0} />);
    const second = render(<BotChallenge challenge={challenge} onToken={vi.fn()} resetKey={0} />);
    expect(document.querySelectorAll('script[src*="challenges.cloudflare.com"]')).toHaveLength(1);
    first.unmount();
    window.turnstile = { render: vi.fn(() => 'widget'), remove: vi.fn(), reset: vi.fn() };
    fireEvent.load(document.querySelector('script[src*="challenges.cloudflare.com"]'));
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(1));
    second.unmount();
    expect(window.turnstile.remove).toHaveBeenCalledTimes(1);
});

test('offers a retry when the provider never finishes loading', async () => {
    vi.useFakeTimers();
    try {
        render(<BotChallenge challenge={challenge} onToken={vi.fn()} resetKey={0} />);
        await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
        expect(screen.getByRole('button', { name: 'Retry security check' })).toBeEnabled();
        expect(screen.getByRole('status')).toHaveTextContent('could not load');
        expect(document.querySelector('script[src*="challenges.cloudflare.com"]')).toBeNull();
    } finally { vi.useRealTimers(); }
});
