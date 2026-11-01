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

test('introduces Medicare with one feature story and a clear registration path', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your health.Your story.All connected.');
  expect(screen.getByRole('region', { name: 'Discover Medicare' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /get started/i })).toHaveLength(2);
  screen.getAllByRole('link', { name: /get started/i }).forEach(link => expect(link).toHaveAttribute('href', '/register'));
  expect(screen.queryByRole('note')).not.toBeInTheDocument();
});

test('shows a recoverable fallback for rendering errors', () => {
  function Broken() { throw new Error('test'); }
  // React reports render exceptions itself; the fallback must still render.
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to display this page');
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});
