import React from 'react';
import { Link } from 'react-router-dom';

export default function DemoUnavailable({ feature }) {
    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
            <section className="max-w-xl rounded-3xl border border-indigo-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-indigo-700 dark:text-indigo-300">Explore safely</p>
                <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">{feature} is unavailable in this demo</h1>
                <p className="mb-6 text-slate-600 dark:text-slate-300">This free demo uses synthetic patient data only. Registration, verification, uploads, email, and AI are disabled. Please use an existing demo account to explore the available workflows.</p>
                <Link to="/login" className="inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">Back to login</Link>
            </section>
        </main>
    );
}
