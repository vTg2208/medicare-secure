import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';

import { staffApi } from './api/staffApi';
vi.mock('./api/staffApi', () => ({ staffApi: { validateInvitation: vi.fn() } }));

test('opens the standard registration form', async () => {
  render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Create Account' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

test('validates invitation links through the invitation page', async () => {
  staffApi.validateInvitation.mockResolvedValue({ success: false });
  render(<MemoryRouter initialEntries={['/staff/invitation/sample-token']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Invalid Invitation' })).toBeInTheDocument();
  expect(staffApi.validateInvitation).toHaveBeenCalledWith('sample-token');
});

test('leads with sharing, retains the feature carousel and onboarding, and routes each audience correctly', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your medical records.Your care team.One secure place.');
  const sharing = screen.getByRole('region', { name: 'See how Medicare sharing works' });
  const features = screen.getByRole('region', { name: 'Discover Medicare' });
  expect(sharing.compareDocumentPosition(features) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('heading', { name: /getting started should be simple/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Make yourself at home' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'See the whole picture' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Keep care connected' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /create patient account/i })).toHaveLength(2);
  screen.getAllByRole('link', { name: /create patient account/i }).forEach(link => expect(link).toHaveAttribute('href', '/register'));
  expect(screen.getByRole('link', { name: /open your patient portal/i })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: /care team sign in/i })).toHaveAttribute('href', '/login');
  expect(document.querySelector(screen.getByRole('link', { name: /see how it works/i }).getAttribute('href'))).toBeInTheDocument();
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

test('shows a recoverable fallback for rendering errors', () => {
  function Broken() { throw new Error('test'); }
  // React reports render exceptions itself; the fallback must still render.
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to display this page');
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});
