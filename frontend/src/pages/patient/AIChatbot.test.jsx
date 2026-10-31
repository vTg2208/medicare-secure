import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AIChatbot from './AIChatbot';
import { startChatbotSession, analyzeChatbotSession } from '../../api/chatbotApi';

vi.mock('../../api/chatbotApi', () => ({ startChatbotSession: vi.fn(), sendChatbotMessage: vi.fn(), analyzeChatbotSession: vi.fn() }));
vi.mock('../../components/common/ThemeToggle', () => ({ default: () => null }));

test('allows retry after summary failure and labels successful summaries as unvalidated drafts', async () => {
    const user = userEvent.setup();
    Element.prototype.scrollIntoView = vi.fn();
    startChatbotSession.mockResolvedValue({ session_id: 'session-1' });
    analyzeChatbotSession.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ summary: { subjective: 'Symptoms reported', objective: 'Not assessed', assessment: 'Requires clinician review', plan: 'Discuss with care team', recommended_department: 'General Medicine' } });
    render(<MemoryRouter><AIChatbot /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: /End & Generate Summary/ }));
    expect(await screen.findByText(/The summary could not be generated/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Describe your symptoms...')).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /End & Generate Summary/ }));
    expect(await screen.findByRole('heading', { name: 'Triage Summary' })).toBeInTheDocument();
    expect(screen.getByText('Unvalidated draft for clinician review. Access requires your consent.')).toBeInTheDocument();
    await waitFor(() => expect(analyzeChatbotSession).toHaveBeenCalledTimes(2));
    expect(analyzeChatbotSession).toHaveBeenLastCalledWith('session-1');
    expect(screen.getByPlaceholderText('Chat ended.')).toBeDisabled();
});
