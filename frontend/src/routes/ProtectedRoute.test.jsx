import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { AuthContext } from '../context/AuthContext';

function checkSession(value) {
    return render(<AuthContext.Provider value={value}><MemoryRouter initialEntries={['/records']}>
        <Routes>
            <Route path="/records" element={<ProtectedRoute allowedRoles={['patient']}><p>Private record</p></ProtectedRoute>} />
            <Route path="/login" element={<p>Sign in required</p>} />
            <Route path="/unauthorized" element={<p>Access denied</p>} />
        </Routes>
    </MemoryRouter></AuthContext.Provider>);
}
test('keeps protected content hidden while authentication loads', () => {
    checkSession({ loading: true, user: null });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Private record')).not.toBeInTheDocument();
});
test('redirects unauthenticated users to login', () => {
    checkSession({ loading: false, user: null });
    expect(screen.getByText('Sign in required')).toBeInTheDocument();
});
test('rejects the wrong role and allows the normalized correct role', () => {
    const view = checkSession({ loading: false, user: { role: 'doctor' } });
    expect(screen.getByText('Access denied')).toBeInTheDocument();
    view.unmount();
    checkSession({ loading: false, user: { roleName: 'PATIENT' } });
    expect(screen.getByText('Private record')).toBeInTheDocument();
});
test('offers retry during a service outage without exposing protected content', () => {
    checkSession({ loading: false, user: null, authError: 'Session service unavailable' });
    expect(screen.getByRole('alert')).toHaveTextContent('Session service unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
});
