import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import Brand from '../../components/common/Brand';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Messages.css';

export default function Messages() {
    const { user } = useAuth();
    const role = user?.role || user?.roleName;
    const [threads, setThreads] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [recipient, setRecipient] = useState('');
    const [selected, setSelected] = useState(null);
    const [messages, setMessages] = useState([]);
    const [canSend, setCanSend] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [conversationError, setConversationError] = useState('');
    const selection = useRef(0);
    const describe = (failure, fallback) => failure.response?.data?.message || fallback;
    const loadInbox = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [inbox, available] = await Promise.all([apiClient.get('/messages/threads'), apiClient.get('/messages/contacts')]);
            setThreads(inbox.data.data); setContacts(available.data.data);
        } catch (failure) { setError(describe(failure, 'Unable to load messages. Please retry.')); }
        finally { setLoading(false); }
    }, []);
    const invalidateSelection = useCallback(() => { selection.current++; }, []);
    useEffect(() => { loadInbox(); return invalidateSelection; }, [loadInbox, invalidateSelection]);
    const open = async (thread, older = false) => {
        const version = ++selection.current;
        if (!older) { setSelected(thread); setMessages([]); setDraft(''); setCanSend(false); setHasMore(false); }
        setConversationError(''); setBusy(true);
        try {
            const response = await apiClient.get('/messages/threads/' + thread.id + '/messages', older ? { params: { before: messages[0]?.sequence } } : undefined);
            if (version !== selection.current) return;
            const data = response.data.data;
            setMessages(current => older ? [...data.messages, ...current] : data.messages);
            setCanSend(data.canSend); setHasMore(data.hasMore);
        } catch (failure) { if (version === selection.current) setConversationError(describe(failure, 'Unable to load this conversation. Please retry.')); }
        finally { if (version === selection.current) setBusy(false); }
    };
    const start = async event => {
        event.preventDefault(); setError(''); setBusy(true);
        try {
            const response = await apiClient.post('/messages/threads', { recipientId: recipient });
            const contact = contacts.find(item => item.id === recipient);
            await open({ ...response.data.data, name: contact?.name || 'Care conversation' });
            await loadInbox();
        } catch (failure) { setError(describe(failure, 'Unable to start a conversation.')); }
        finally { setBusy(false); }
    };
    const send = async event => {
        event.preventDefault();
        const version = selection.current;
        const thread = selected;
        setBusy(true); setConversationError('');
        try {
            const response = await apiClient.post('/messages/threads/' + thread.id + '/messages', { body: draft });
            if (version !== selection.current) return;
            setMessages(current => [...current, response.data.data]); setDraft('');
        } catch (failure) { if (version === selection.current) setConversationError(describe(failure, 'Message was not saved. Please retry.')); }
        finally { if (version === selection.current) setBusy(false); }
    };
    return <div className="care-messages mc-workspace">
        <header><Brand to={'/' + role + '/dashboard'} /><Link to={'/' + role + '/dashboard'}>Dashboard</Link><ThemeToggle /></header>
        <main><h1>Messages</h1><p>Private correspondence with your current, consenting care team. This inbox is not monitored for emergencies.</p>
            {error && <div role="alert">{error} <button onClick={loadInbox}>Retry</button></div>}
            {loading && <p role="status">Loading messages…</p>}
            {!loading && !error && <form onSubmit={start} className="care-message-start">
                <label htmlFor="care-contact">Care team contact</label><select id="care-contact" value={recipient} onChange={event => setRecipient(event.target.value)} required>
                    <option value="">Choose a contact</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                </select><button disabled={!recipient || busy}>Start conversation</button>
                {!contacts.length && <p>No current care contacts with active consent.</p>}
            </form>}
            <div className="care-message-columns"><nav aria-label="Conversations">
                {!loading && !error && !threads.length && <p>No conversations yet.</p>}
                {threads.map(thread => <button key={thread.id} onClick={() => open(thread)} aria-current={selected?.id === thread.id ? 'true' : undefined}>{thread.name}</button>)}
            </nav><section aria-label="Conversation">
                {!selected ? <p>Select a conversation or start one with an authorized care contact.</p> : <>
                    <div className="care-message-heading"><h2>{selected.name}</h2><button onClick={() => open(selected)} disabled={busy}>Refresh conversation</button></div>
                    {conversationError && <p role="alert">{conversationError}</p>}
                    {hasMore && <button onClick={() => open(selected, true)} disabled={busy}>Load older messages</button>}
                    <ol className="care-message-history" aria-live="polite">{messages.map(message => <li key={message.id} className={message.sender_id === user.id ? 'care-message-own' : ''}>
                        <span>{message.sender_id === user.id ? 'You' : selected.name}</span><p>{message.body}</p>
                        {message.created_at && <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>}
                    </li>)}</ol>
                    {!canSend && !busy && <p>Sending requires current patient consent and assigned care. Your available history remains visible.</p>}
                    <form onSubmit={send}><label htmlFor="care-message-body">Message</label><textarea id="care-message-body" rows={3} maxLength={4000} value={draft} onChange={event => setDraft(event.target.value)} disabled={!canSend || busy} required />
                        <button disabled={!canSend || !draft.trim() || busy}>Send message</button></form>
                </>}
            </section></div>
        </main>
    </div>;
}
