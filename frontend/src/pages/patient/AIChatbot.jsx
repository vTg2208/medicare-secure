import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { startChatbotSession, sendChatbotMessage, analyzeChatbotSession } from '../../api/chatbotApi';
import ThemeToggle from '../../components/common/ThemeToggle';
import './AIChatbot.css';

function AIChatbot() {
    const navigate = useNavigate();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionEnded, setSessionEnded] = useState(false);
    const [summary, setSummary] = useState(null);
    const messagesEndRef = useRef(null);

    // Initialize session
    useEffect(() => {
        const initChat = async () => {
            try {
                setIsLoading(true);
                const res = await startChatbotSession();
                setSessionId(res.session_id);
                setMessages([{ role: 'bot', text: "Hello! I'm the AI Triage Assistant. Could you please describe what symptoms you're currently experiencing?" }]);
            } catch (error) {
                setMessages([{ role: 'bot', text: "Sorry, I'm currently unable to connect to the medical knowledge base. Please try again later or consult a doctor." }]);
            } finally {
                setIsLoading(false);
            }
        };
        initChat();
    }, []);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!input.trim() || !sessionId || isLoading || sessionEnded) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsLoading(true);

        try {
            const res = await sendChatbotMessage(sessionId, userMsg);
            setMessages(prev => [...prev, { role: 'bot', text: res.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'bot', text: "Error: I'm having trouble reasoning right now. Please describe your symptoms again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndChat = async () => {
        if (!sessionId || sessionEnded || isLoading) return;
        setIsLoading(true);
        setSessionEnded(true);

        try {
            setMessages(prev => [...prev, { role: 'bot', text: "Analyzing your symptoms and generating a SOAP summary for the doctor. Please wait..." }]);
            const res = await analyzeChatbotSession(sessionId);
            setSummary(res.summary);
            setMessages(prev => [...prev, { role: 'bot', text: "Thank you for sharing your symptoms. The triage summary has been saved for your doctor's review." }]);
        } catch (error) {
            setSessionEnded(false);
            setMessages(prev => [...prev, { role: 'bot', text: "The summary could not be generated. Please retry or contact your care team." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chatbot-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex flex-col h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-4">
                <button
                    onClick={() => navigate('/patient/dashboard')}
                    className="glass-button px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/50 dark:hover:bg-slate-800/50 transition">
                    Back to Dashboard
                </button>
                <ThemeToggle />
            </div>

            <main className="flex-grow p-4 md:p-8 flex items-center justify-center max-h-screen">
                <div className="w-full max-w-4xl h-[90%] glass-card rounded-3xl flex flex-col overflow-hidden relative shadow-2xl border border-white/20 dark:border-slate-700/50">

                    {/* Header */}
                    <div className="h-20 border-b border-indigo-100 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                <span className="material-symbols-outlined text-2xl">smart_toy</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">AI Pre-Screening Assistant</h2>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">SECURE MEDICAL TRIAGE</p>
                            </div>
                        </div>

                        {!sessionEnded && sessionId && (
                            <button
                                onClick={handleEndChat}
                                className="px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">fact_check</span>
                                End &amp; Generate Summary
                            </button>
                        )}
                    </div>

                    {/* Chat Area */}
                    <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/30 dark:bg-slate-900/10">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center shadow-md ${msg.role === 'user'
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                                        }`}>
                                        <span className="material-symbols-outlined text-xl">
                                            {msg.role === 'user' ? 'person' : 'smart_toy'}
                                        </span>
                                    </div>
                                    <div className={`px-5 py-4 rounded-2xl shadow-sm ${msg.role === 'user'
                                            ? 'bg-indigo-600 dark:bg-indigo-500 text-white rounded-tr-none'
                                            : 'glass-panel bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                                        }`}>
                                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="flex gap-3 max-w-[80%]">
                                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shadow-md">
                                        <span className="material-symbols-outlined text-xl">smart_toy</span>
                                    </div>
                                    <div className="px-5 py-4 rounded-2xl rounded-tl-none glass-panel bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/60">
                        <form onSubmit={handleSend} className="relative flex items-center">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isLoading || sessionEnded || !sessionId}
                                placeholder={sessionEnded ? "Chat ended." : "Describe your symptoms..."}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-0 rounded-2xl py-4 pl-6 pr-16 text-[15px] text-slate-800 dark:text-slate-100 shadow-sm transition-colors disabled:opacity-60"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading || sessionEnded || !sessionId}
                                className="absolute right-3 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-md"
                            >
                                <span className="material-symbols-outlined text-xl">send</span>
                            </button>
                        </form>
                        <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                    This AI assistant provides an unvalidated draft for clinician review. It cannot diagnose conditions or issue prescriptions. In an emergency, contact your local emergency service immediately.
                        </p>
                    </div>

                </div>
            </main>

            {/* Summary Overlay */}
            {summary && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 transform transition-all animate-in fade-in zoom-in duration-300">
                        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-700">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Triage Summary</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Unvalidated draft for clinician review. Access requires your consent.</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <span className="material-symbols-outlined text-3xl">check_circle</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Recommended Department</p>
                                <p className="font-semibold text-lg text-indigo-600 dark:text-indigo-400">{summary.recommended_department}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Model self-rating (not clinically validated)</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">A clinician must assess urgency and next steps.</p>
                            </div>
                        </div>

                        <div className="space-y-4 text-sm mt-4">
                            <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Subjective:</span>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">{summary.subjective}</p>
                            </div>
                            <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Objective:</span>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">{summary.objective}</p>
                            </div>
                            <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Assessment:</span>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">{summary.assessment}</p>
                            </div>
                            <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300">Plan:</span>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">{summary.plan}</p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-4">
                            <button
                                onClick={() => navigate('/patient/dashboard')}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AIChatbot;
