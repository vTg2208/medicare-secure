import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Dashboard.css';

function Messages() {
    const navigate = useNavigate();

    const mockMessages = [
        {
            id: 1,
            sender: "Dr. Omar Hassan",
            specialty: "Neurology",
            lastMessage: "Your latest EEG results look normal. I've scheduled a follow-up for next week.",
            time: "2 hours ago",
            unread: true
        },
        {
            id: 2,
            sender: "Dr. Elena Rodriguez",
            specialty: "General Practice",
            lastMessage: "Please remember to complete your fast before the blood work on Monday.",
            time: "Yesterday",
            unread: false
        },
        {
            id: 3,
            sender: "Hospital Admin",
            specialty: "Medicare Support",
            lastMessage: "Welcome to Medicare! Let us know if you need help navigating your records.",
            time: "3 days ago",
            unread: false
        }
    ];

    return (
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Sidebar (same as dashboard) */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer group" onClick={() => navigate('/patient/dashboard')}>
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <span className="material-symbols-outlined text-xl transition-transform duration-500 group-hover:scale-110">local_hospital</span>
                        </div>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white transition-all duration-500 drop-shadow-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]">Medicare</h1>
                </div>
                <nav className="space-y-2 flex-grow">
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-100">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                        Messages
                    </Link>
                    <Link to="/patient/medical-records" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/patient/consent" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/patient/audit-trail" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Audit Trail
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                </div>
            </aside>

            <main className="flex-grow p-8 overflow-y-auto h-full relative flex flex-col">
                <header className="mb-10">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Messages</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Secure communication with your healthcare providers.</p>
                </header>

                <div className="flex-grow glass-card rounded-3xl border border-white/50 dark:border-slate-700/50 overflow-hidden flex flex-col md:flex-row shadow-xl">
                    {/* Chat List */}
                    <div className="w-full md:w-80 border-r border-slate-100 dark:border-slate-800/50 flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-grow">
                            {mockMessages.map((chat) => (
                                <div key={chat.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors relative ${chat.unread ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0 font-bold uppercase">
                                            {chat.sender[0]}
                                        </div>
                                        <div className="min-w-0 flex-grow">
                                            <div className="flex justify-between items-start mb-1">
                                                <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{chat.sender}</h5>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{chat.time}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{chat.lastMessage}</p>
                                        </div>
                                        {chat.unread && (
                                            <div className="absolute right-4 bottom-4 w-2 h-2 bg-indigo-500 rounded-full"></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chat Content Placeholder */}
                    <div className="flex-grow flex flex-col items-center justify-center p-12 text-center bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 scale-110">
                            <span className="material-symbols-outlined text-4xl">forum</span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Select a Conversation</h4>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm">Choose a provider from the list to start a secure discussion about your health records or appointments.</p>
                        <button className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all">
                            New Conversation
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Messages;
