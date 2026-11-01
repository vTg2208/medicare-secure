import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import apiClient from '../../api/client';
import Messages from './Messages';
import Dashboard from './Dashboard';

const renderPage = (role = 'patient') => render(<MemoryRouter><ThemeProvider><AuthContext.Provider value={{ user: { id: role === 'patient' ? 'patient' : 'doctor', role } }}><Messages /></AuthContext.Provider></ThemeProvider></MemoryRouter>);
beforeEach(() => vi.restoreAllMocks());
test('an empty inbox is real and lets the patient start and persist a conversation', async () => {
    const user = userEvent.setup();
    let started = false; let sent = false;
    vi.spyOn(apiClient, 'get').mockImplementation(async path => ({ data: { success: true, data:
        path.endsWith('/contacts') ? [{ id: 'doctor', name: 'Current clinician' }] :
        path.endsWith('/threads') ? (started ? [{ id: 'thread', name: 'Current clinician' }] : []) :
        { canSend: true, messages: sent ? [{ id: 'message', sequence: '1', sender_id: 'patient', body: 'A private question', created_at: '2026-11-01T10:00:00Z' }] : [], hasMore: false } } }));
    vi.spyOn(apiClient, 'post').mockImplementation(async (path, body) => {
        if (path.endsWith('/threads')) { started = true; return { data: { data: { id: 'thread' } } }; }
        sent = body.body === 'A private question';
        return { data: { data: { id: 'message', sequence: '1', sender_id: 'patient', body: body.body, created_at: '2026-11-01T10:00:00Z' } } };
    });
    renderPage();
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Care team contact'), 'doctor');
    await user.click(screen.getByRole('button', { name: 'Start conversation' }));
    await user.type(await screen.findByLabelText('Message'), 'A private question');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('A private question')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue('');
});
test('a physician reads persisted correspondence and sees revoked sending access', async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, 'get').mockImplementation(async path => ({ data: { data: path.endsWith('/contacts') ? [] : path.endsWith('/threads') ? [{ id: 'thread', name: 'Assigned patient' }] : { canSend: false, messages: [{ id: 'message', sequence: '1', sender_id: 'patient', body: 'Earlier patient question' }] } } }));
    renderPage('doctor');
    await user.click(await screen.findByRole('button', { name: 'Assigned patient' }));
    expect(await screen.findByText('Earlier patient question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
});
test('an inbox outage is visible and retry loads the real empty state', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('offline'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load messages');
    expect(screen.queryByText('No conversations yet.')).not.toBeInTheDocument();
    get.mockResolvedValue({ data: { data: [] } });
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('No conversations yet.')).toBeInTheDocument());
});

test('the patient dashboard opens the real messages inbox',async()=>{
    vi.spyOn(apiClient,'get').mockResolvedValue({data:{success:true,data:[]}});
    const user=userEvent.setup();
    render(<MemoryRouter initialEntries={['/patient/dashboard']}><ThemeProvider><AuthContext.Provider value={{user:{id:'patient',role:'patient',firstName:'Synthetic',lastName:'Patient'}}}><Routes><Route path="/patient/dashboard" element={<Dashboard/>}/><Route path="/patient/messages" element={<Messages/>}/></Routes></AuthContext.Provider></ThemeProvider></MemoryRouter>);
    await user.click(screen.getByRole('link',{name:/Messages/}));
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument();
});
