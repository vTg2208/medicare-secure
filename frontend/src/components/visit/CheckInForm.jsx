// CheckInForm Component - Patient visit check-in
import React, { useState } from 'react';
import './CheckInForm.css';

function CheckInForm({ onCheckIn }) {
    const [visitCode, setVisitCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Only digits
        if (value.length <= 6) {
            setVisitCode(value);
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (visitCode.length !== 6) {
            setError('Please enter a 6-digit visit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await onCheckIn(visitCode);
            setVisitCode('');
        } catch (err) {
            setError(err.response?.data?.message || 'Check-in failed. Please verify your code.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 transition-all">
            <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-teal-50 dark:bg-slate-700 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 border border-teal-100 dark:border-slate-600">
                    🏥
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white m-0">Check In for Your Visit</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 m-0">Enter your 6-digit visit code to check in</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="visitCode" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 text-center uppercase tracking-wider">
                        Visit Code
                    </label>
                    <input
                        type="text"
                        id="visitCode"
                        className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-2xl tracking-[0.5em] text-center font-bold text-gray-900 dark:text-white disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-800"
                        value={visitCode}
                        onChange={handleChange}
                        placeholder="000000"
                        maxLength="6"
                        autoComplete="off"
                        required
                    />
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">
                        {visitCode.length}/6 digits
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-lg text-sm text-center flex items-center justify-center gap-2">
                        <span className="text-lg">⚠️</span> {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={visitCode.length !== 6 || loading}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    {loading ? 'Checking in...' : 'Check In'}
                </button>

                <div className="pt-6 mt-6 border-t border-gray-100 dark:border-slate-700 text-center flex flex-col justify-center items-center">
                    <p className="text-gray-900 dark:text-white font-semibold text-sm m-0 mb-1">Don't have a visit code?</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs m-0 leading-relaxed max-w-xs">Your visit code was sent to you via SMS/Email when your appointment was scheduled.</p>
                </div>
            </form>
        </div>
    );
}

export default CheckInForm;
