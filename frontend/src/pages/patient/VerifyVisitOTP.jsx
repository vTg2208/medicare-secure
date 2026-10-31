import React, { useState } from 'react';
import { visitApi } from '../../api/visitApi';
import './VerifyVisitOTP.css';

const VerifyVisitOTP = () => {
    const [visitId, setVisitId] = useState('');
    const [otp, setOtp] = useState('');
    const [accessLevel, setAccessLevel] = useState('read');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!visitId || !otp) {
            setError('Please enter visit ID and OTP');
            return;
        }

        if (otp.length !== 6) {
            setError('OTP must be 6 digits');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            await visitApi.verifyVisitOTP(visitId, otp, accessLevel);

            setSuccess(true);
            setError(null);

            // Redirect after success
            setTimeout(() => {
                window.location.href = '/patient/visits';
            }, 2000);

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to verify OTP');
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-[80vh] flex justify-center items-center p-5 bg-slate-50 dark:bg-slate-900">
                <div className="w-full max-w-md bg-surface dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-10 text-center transition-all">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
                        ✓
                    </div>
                    <h2 className="text-green-600 dark:text-green-400 font-bold text-2xl mb-3 m-0">OTP Verified Successfully!</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-2 m-0">Your doctor has been granted access to your medical records.</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm italic m-0">Redirecting to visits...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[80vh] flex justify-center items-center p-5 bg-slate-50 dark:bg-slate-900">
            <div className="w-full max-w-md bg-surface dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 transition-all">
                <h2 className="text-gray-900 dark:text-white font-bold text-2xl mb-2 m-0">Verify Hospital Visit OTP</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm m-0">Enter the OTP provided by the hospital</p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Visit ID</label>
                        <input
                            type="text"
                            value={visitId}
                            onChange={(e) => setVisitId(e.target.value)}
                            placeholder="Enter your visit ID"
                            disabled={loading}
                            className="w-full px-4 py-2.5 bg-surface dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-gray-900 dark:text-white disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-800"
                        />
                        <small className="block mt-1.5 text-xs text-gray-400 dark:text-gray-500">You can find this in your visit confirmation</small>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">OTP Code</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Enter 6-digit OTP"
                            maxLength="6"
                            className="w-full px-4 py-3 bg-surface dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-2xl tracking-[0.5em] text-center font-bold text-gray-900 dark:text-white disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-800"
                            disabled={loading}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Access Level</label>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 m-0">
                            Choose what level of access to grant your doctor:
                        </p>

                        <div className="space-y-3">
                            <label className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${accessLevel === 'read' ? "border-primary-500 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/20" : "border-gray-100 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-500/50 hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}>
                                <input
                                    type="radio"
                                    name="accessLevel"
                                    value="read"
                                    checked={accessLevel === 'read'}
                                    onChange={(e) => setAccessLevel(e.target.value)}
                                    disabled={loading}
                                    className="hidden"
                                />
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl flex-shrink-0">🔍</div>
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white font-bold mb-1">Read Only</strong>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm m-0">Doctor can view your medical records</p>
                                    </div>
                                </div>
                            </label>

                            <label className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${accessLevel === 'write' ? "border-primary-500 dark:border-primary-400 bg-primary-50/50 dark:bg-primary-900/20" : "border-gray-100 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-500/50 hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}>
                                <input
                                    type="radio"
                                    name="accessLevel"
                                    value="write"
                                    checked={accessLevel === 'write'}
                                    onChange={(e) => setAccessLevel(e.target.value)}
                                    disabled={loading}
                                    className="hidden"
                                />
                                <div className="flex items-center gap-4">
                                    <div className="text-2xl flex-shrink-0">✏️</div>
                                    <div>
                                        <strong className="block text-gray-900 dark:text-white font-bold mb-1">Read & Write</strong>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm m-0">Doctor can view and add records (prescriptions, notes, etc.)</p>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400 p-4 rounded text-sm flex items-center gap-2 mt-4">
                            <span className="text-lg">⚠️</span>
                            {error}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:translate-y-0 bg-primary-600"
                            disabled={loading || !visitId || !otp}
                        >
                            {loading ? 'Verifying...' : 'Verify OTP & Grant Access'}
                        </button>
                    </div>
                </form>

                <div className="mt-8 p-4 border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 rounded-r-lg">
                    <strong className="block text-gray-900 dark:text-white font-bold mb-2 m-0">💡 Note:</strong>
                    <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1 m-0 pl-5 list-disc">
                        <li>OTP is valid for 24 hours</li>
                        <li>You can change access level later if needed</li>
                        <li>Your consent will be active for 30 days</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default VerifyVisitOTP;
