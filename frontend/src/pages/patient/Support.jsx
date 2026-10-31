import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Dashboard.css';

function Support() {
    const navigate = useNavigate();

    const faqs = [
        {
            question: "How do I grant consent to a doctor?",
            answer: "Go to the 'Consents' page in your dashboard and click 'Grant New Consent'. You can then search for your doctor and specify which records they can access."
        },
        {
            question: "Can I download my medical records as PDF?",
            answer: "Yes, once you view a specific medical record, you'll see an 'Export as PDF' button at the top right of the record details."
        },
        {
            question: "How do I schedule a visit?",
            answer: "Navigate to the 'Appointments' page and click on 'Schedule New Visit'. You can choose between a walk-in or a scheduled appointment with a specific doctor."
        },
        {
            question: "What is the 'Audit Trail'?",
            answer: "The Audit Trail is a security feature that shows every person who has accessed or modified your medical data, ensuring full transparency."
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
                    <Link to="/patient/messages" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
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
                    <Link to="/patient/support" className="flex items-center gap-3 px-4 py-3 sidebar-item-active rounded-xl font-medium text-slate-800 dark:text-slate-100">
                        <span className="material-symbols-outlined text-[20px]">favorite_border</span>
                        Support
                    </Link>
                    <Link to="/patient/profile" className="flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 transition rounded-xl">
                        <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                        Profile
                    </Link>
                </div>
            </aside>

            <main className="flex-grow p-8 overflow-y-auto h-full relative">
                <header className="mb-10 text-center max-w-2xl mx-auto">
                    <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 inline-block">Support Center</span>
                    <h2 className="text-4xl font-bold text-slate-900 dark:text-white mt-2">How can we help?</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-4 font-medium">Find answers to common questions or reach out to our dedicated medical support team.</p>
                </header>

                <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {/* Contact Cards */}
                    <div className="glass-card p-8 rounded-3xl border border-white/50 dark:border-slate-700/50 text-center hover:scale-[1.02] transition-transform duration-300">
                        <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl">email</span>
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Email Support</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">General inquiries, feedback, or account issues.</p>
                        <a href="mailto:support@medicare.com" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">support@medicare.com</a>
                    </div>

                    <div className="glass-card p-8 rounded-3xl border border-white/50 dark:border-slate-700/50 text-center hover:scale-[1.02] transition-transform duration-300">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-6">
                            <span className="material-symbols-outlined text-3xl">call</span>
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-2">24/7 Helpline</h4>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Immediate medical guidance or urgent assistance.</p>
                        <a href="tel:+1800MEDICARE" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">1-800-MED-HELP</a>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-8 flex items-center gap-3 justify-center">
                        <span className="material-symbols-outlined text-indigo-500">quiz</span>
                        Frequently Asked Questions
                    </h3>
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <div key={index} className="glass-card p-6 rounded-2xl border border-white/50 dark:border-slate-700/50">
                                <h5 className="font-bold text-slate-800 dark:text-white mb-2">{faq.question}</h5>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <footer className="mt-20 text-center pb-10">
                    <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">Medicare Support v1.0.4</p>
                </footer>
            </main>
        </div>
    );
}

export default Support;
