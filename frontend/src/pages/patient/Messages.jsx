import Brand from '../../components/common/Brand';
import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Dashboard.css';

function Messages() {

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
        <div className="patient-dashboard-wrapper bg-[var(--background-light)] dark:bg-[var(--background-dark)] text-slate-800 dark:text-slate-100 flex h-screen w-full overflow-hidden mc-workspace">
            <div className="mc-workspace-theme">
                <ThemeToggle />
            </div>

            {/* Sidebar (same as dashboard) */}
            <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800/50 p-6 flex flex-col h-full overflow-y-auto mc-sidebar">
                <Brand to={'/patient/dashboard'} />
                <nav className="space-y-2 flex-grow">
                    <Link to="/patient/dashboard" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        Dashboard
                    </Link>
                    <Link to="/patient/visits" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                        Appointments
                    </Link>
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-100">
                        <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                        Messages
                    </Link>
                    <Link to="/patient/medical-records" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                        Records
                    </Link>
                    <Link to="/patient/consent" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        Consents
                    </Link>
                    <Link to="/patient/audit-trail" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">history</span>
                        Audit Trail
                    </Link>
                </nav>
                <div className="space-y-2 mt-auto pt-6 border-t border-slate-200 dark:border-slate-800/50">
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-surface dark:hover:bg-surface transition rounded-xl">
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

                <div className="flex-grow glass-card rounded-3xl border border-line dark:border-slate-700/50 overflow-hidden flex flex-col md:flex-row shadow-sm">
                    {/* Chat List */}
                    <div className="w-full md:w-80 border-r border-slate-100 dark:border-slate-800/50 flex flex-col">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800/50">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-500"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            </div>
                        </div>
                        <div className="overflow-y-auto flex-grow">
                            {mockMessages.map((chat) => (
                                <div key={chat.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-surface cursor-pointer transition-colors relative ${chat.unread ? "bg-primary-50/30 dark:bg-primary-900/10" : ''}`}>
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0 font-bold uppercase">
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
                                            <div className="absolute right-4 bottom-4 w-2 h-2 bg-primary-500 rounded-full"></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chat Content Placeholder */}
                    <div className="flex-grow flex flex-col items-center justify-center p-12 text-center bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 rounded-3xl flex items-center justify-center text-primary-600 dark:text-primary-400 mb-6 scale-110">
                            <span className="material-symbols-outlined text-4xl">forum</span>
                        </div>
                        <h4 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Select a Conversation</h4>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm">Choose a provider from the list to start a secure discussion about your health records or appointments.</p>
                        <button className="mt-8 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg shadow-primary-500/25 transition-all">
                            New Conversation
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Messages;
