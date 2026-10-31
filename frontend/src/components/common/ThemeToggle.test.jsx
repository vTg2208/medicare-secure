import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

test('shares and persists the selected theme when moving between screens', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MemoryRouter><ThemeProvider><Routes>
        <Route path="/" element={<><ThemeToggle /><Link to="/next">Next screen</Link></>} />
        <Route path="/next" element={<><h1>Next screen</h1><ThemeToggle /></>} />
    </Routes></ThemeProvider></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Toggle Dark Mode' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    await user.click(screen.getByRole('link', { name: 'Next screen' }));
    expect(screen.getByRole('button', { name: 'Toggle Dark Mode' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Toggle Dark Mode' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');

    unmount();
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    expect(screen.getByRole('button', { name: 'Toggle Dark Mode' })).toHaveAttribute('aria-pressed', 'false');
});
