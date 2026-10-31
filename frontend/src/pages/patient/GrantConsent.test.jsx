import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GrantConsent from './GrantConsent';

test('redirects the legacy grant route into the canonical recipient-based consent flow', async () => {
    render(<MemoryRouter initialEntries={['/patient/consent/grant']}><Routes>
        <Route path="/patient/consent/grant" element={<GrantConsent />} />
        <Route path="/patient/consent" element={<h1>Manage recipient consent</h1>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Manage recipient consent' })).toBeInTheDocument();
});
