import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';

const demoConfig = vi.hoisted(() => ({ isDemoMode: false }));
vi.mock('./config/demoMode', () => demoConfig);
beforeEach(() => { demoConfig.isDemoMode = false; });

test('shows an accessible global notice and replaces registration in demo builds', async () => {
  demoConfig.isDemoMode = true;
  render(<MemoryRouter initialEntries={['/register']}><App /></MemoryRouter>);
  const notice = screen.getByRole('note', { name: /free demo/i });
  expect(notice).toHaveTextContent(/synthetic patient data only/i);
  expect(notice).toHaveTextContent(/do not enter actual patient information/i);
  expect(notice).toHaveTextContent(/uploads, email, and AI are unavailable/i);
  expect(await screen.findByRole('heading', { name: /registration is unavailable in this demo/i })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login');
});

test('does not start invitation verification in demo builds', async () => {
  demoConfig.isDemoMode = true;
  render(<MemoryRouter initialEntries={['/staff/invitation/sample-token']}><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: /invitation verification is unavailable in this demo/i })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('introduces Medicare with one feature story and a clear registration path', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your health.Your story.All connected.');
  expect(screen.getByRole('region', { name: 'Discover Medicare' })).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /get started/i })).toHaveLength(2);
  screen.getAllByRole('link', { name: /get started/i }).forEach(link => expect(link).toHaveAttribute('href', '/register'));
  expect(screen.queryByRole('note', { name: /free demo/i })).not.toBeInTheDocument();
});

test('homepage demo calls to action lead to login without offering registration', async () => {
  demoConfig.isDemoMode = true;
  render(<MemoryRouter><App /></MemoryRouter>);
  const links = await screen.findAllByRole('link', { name: /explore the demo/i });
  links.forEach(link => expect(link).toHaveAttribute('href', '/login'));
  expect(screen.getByRole('note', { name: /free demo/i })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /get started/i })).not.toBeInTheDocument();
});

test('shows a recoverable fallback for rendering errors', () => {
  function Broken() { throw new Error('test'); }
  // React reports render exceptions itself; the fallback must still render.
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to display this page');
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});
