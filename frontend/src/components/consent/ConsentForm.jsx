import React, { useState, useEffect } from 'react';
import Input from '../common/Input';
import { consentApi } from '../../api/consentApi';
import './ConsentForm.css';
function ConsentForm({ onSuccess, onCancel, initialData }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [doctors, setDoctors] = useState([]);
    const [duration, setDuration] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [formData, setFormData] = useState({
        recipientUserId: '',
        dataCategory: 'all_medical_data',
        purpose: 'treatment',
        accessLevel: 'read',
        startTime: new Date().toISOString().split('T')[0],
        endTime: '',
    });

    // Handle unlimited (all 0s)
    const isUnlimited = duration.hours === 0 && duration.minutes === 0 && duration.seconds === 0;

    // Load initial data if editing
    useEffect(() => {
        if (initialData) {
            setFormData({
                recipientUserId: initialData.recipientUserId,
                dataCategory: initialData.dataCategory,
                purpose: initialData.purpose,
                accessLevel: initialData.accessLevel,
                startTime: new Date(initialData.startTime).toISOString().split('T')[0],
                endTime: initialData.endTime || '',
            });

            if (initialData.endTime) {
                const total = new Date(initialData.endTime).getTime() - new Date(initialData.startTime).getTime();
                // Convert total milliseconds to hours, minutes, seconds
                // We ignore days and convert everything to hours if needed, or just standard H:M:S breakdown
                // ensuring we capture meaningful time.
                // However, user just wants to REMOVE the days input.
                // Standard logic:
                // Standard logic:
                // Calculate total hours directly
                const hours = Math.floor(total / (1000 * 60 * 60));
                const minutes = Math.floor((total / 1000 / 60) % 60);
                const seconds = Math.floor((total / 1000) % 60);
                setDuration({ hours, minutes, seconds });
            }
        }
    }, [initialData]);

    // Calculate Effective End Time for display
    const calculateEffectiveEndTime = () => {
        if (isUnlimited) return null;

        const now = new Date();
        const inputDate = new Date(formData.startTime);
        const todayDate = new Date(now.toISOString().split('T')[0]);

        const startDate = inputDate.getTime() <= todayDate.getTime() ? now : inputDate;
        const totalSeconds = (parseInt(duration.hours || 0) * 3600) +
            (parseInt(duration.minutes || 0) * 60) +
            (parseInt(duration.seconds || 0));

        return new Date(startDate.getTime() + totalSeconds * 1000);
    };

    const displayEndTime = calculateEffectiveEndTime();

    const handleDurationChange = (e) => {
        const { name, value } = e.target;
        setDuration(prev => ({
            ...prev,
            [name]: Math.max(0, parseInt(value) || 0)
        }));
    };

    useEffect(() => {
        loadDoctors();
    }, []);

    const loadDoctors = async () => {
        try {
            const data = await consentApi.getAvailableDoctors();
            setDoctors(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not load consent recipients. Please retry.');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const submitData = { ...formData };
            const effectiveEnd = calculateEffectiveEndTime();

            if (isUnlimited) {
                submitData.endTime = null;
            } else if (effectiveEnd) {
                submitData.endTime = effectiveEnd.toISOString();

                // If the start date was "today", the effective calculation used "now"
                // which is exactly what we want to send to the backend.
                const now = new Date();
                const inputDate = new Date(submitData.startTime);
                const todayDate = new Date(now.toISOString().split('T')[0]);
                if (inputDate.getTime() <= todayDate.getTime()) {
                    submitData.startTime = now.toISOString();
                }
            }

            if (initialData) {
                await consentApi.updateConsent(initialData.id, submitData);
            } else {
                await consentApi.grantConsent(submitData);
            }
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to process consent');
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 md:p-8 mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white m-0 mb-1">Grant Data Access Consent</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 m-0">
                Control who can access your medical data and for what purpose
            </p>
            <form onSubmit={handleSubmit} className="text-gray-700 dark:text-gray-300">
                {/* Doctor Selection */}
                <div className="form-group">
                    <label htmlFor="recipientUserId" className="dark:text-gray-300">Grant Access To *</label>
                    <select
                        id="recipientUserId"
                        name="recipientUserId"
                        value={formData.recipientUserId}
                        onChange={handleChange}
                        required
                        className="form-select dark:bg-slate-700 dark:text-white dark:border-slate-600"
                        disabled={!!initialData}
                    >
                        <option value="">Select a care or research recipient...</option>
                        {doctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                                {doctor.firstName} {doctor.lastName} — {doctor.role?.replaceAll('_', ' ')} — {doctor.organization}
                            </option>
                        ))}
                    </select>
                    {initialData && <small className="text-muted">Recipient cannot be changed when editing.</small>}
                </div>
                {/* Data Category */}
                <div className="form-group">
                    <label htmlFor="dataCategory" className="dark:text-gray-300">Data Category *</label>
                    <select
                        id="dataCategory"
                        name="dataCategory"
                        value={formData.dataCategory}
                        onChange={handleChange}
                        required
                        className="form-select dark:bg-slate-700 dark:text-white dark:border-slate-600"
                    >
                        <option value="all_medical_data">All Medical Data</option>
                        <option value="diagnoses">Diagnoses Only</option>
                        <option value="prescriptions">Prescriptions Only</option>
                        <option value="lab_results">Lab Results Only</option>
                        <option value="imaging">Imaging Reports Only</option>
                        <option value="vital_signs">Vitals Only</option>
                        <option value="insurance_claim">Insurance Claims and Coverage</option>
                    </select>
                </div>
                {/* Purpose */}
                <div className="form-group">
                    <label htmlFor="purpose" className="dark:text-gray-300">Purpose *</label>
                    <select
                        id="purpose"
                        name="purpose"
                        value={formData.purpose}
                        onChange={handleChange}
                        required
                        className="form-select dark:bg-slate-700 dark:text-white dark:border-slate-600"
                    >
                        <option value="treatment">Treatment</option>
                        <option value="consultation">Consultation</option>
                        <option value="second_opinion">Second Opinion</option>
                        <option value="clinical_research">Research (Anonymized)</option>
                        <option value="insurance_claim">Insurance Claim Processing</option>
                    </select>
                </div>
                {/* Access Level */}
                <div className="form-group">
                    <label htmlFor="accessLevel" className="dark:text-gray-300">Access Level *</label>
                    <select
                        id="accessLevel"
                        name="accessLevel"
                        value={formData.accessLevel}
                        onChange={handleChange}
                        required
                        className="form-select dark:bg-slate-700 dark:text-white dark:border-slate-600"
                    >
                        <option value="read">Read Only</option>
                        <option value="write">Read & Write</option>
                    </select>
                </div>
                {/* Duration and Time Range */}
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                    <Input
                        label="Start Date"
                        type="date"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleChange}
                        required
                    />

                    <div className="form-group" style={{ flex: 2 }}>
                        <label className="dark:text-gray-300">Duration</label>
                        <div className="duration-container gap-2">
                            <div className="duration-field">
                                <input
                                    type="number"
                                    name="hours"
                                    placeholder="0"
                                    value={duration.hours || ''}
                                    onChange={handleDurationChange}
                                    min="0"
                                    className="dark:bg-slate-700 dark:text-white dark:border-slate-600 rounded-md border"
                                />
                                <label className="text-xs text-center dark:text-gray-400 mt-1">Hours</label>
                            </div>
                            <div className="duration-field">
                                <input
                                    type="number"
                                    name="minutes"
                                    placeholder="0"
                                    value={duration.minutes || ''}
                                    onChange={handleDurationChange}
                                    min="0" max="59"
                                    className="dark:bg-slate-700 dark:text-white dark:border-slate-600 rounded-md border"
                                />
                                <label className="text-xs text-center dark:text-gray-400 mt-1">Mins</label>
                            </div>
                            <div className="duration-field">
                                <input
                                    type="number"
                                    name="seconds"
                                    placeholder="0"
                                    value={duration.seconds || ''}
                                    onChange={handleDurationChange}
                                    min="0" max="59"
                                    className="dark:bg-slate-700 dark:text-white dark:border-slate-600 rounded-md border"
                                />
                                <label className="text-xs text-center dark:text-gray-400 mt-1">Secs</label>
                            </div>
                        </div>
                        <small className="text-muted dark:text-gray-400 mt-2 block">Set all to 0 for unlimited access.</small>
                    </div>
                </div>

                {/* Expiry Message */}
                <div className="info-alert" style={{ marginTop: '-10px', marginBottom: '15px' }}>
                    {isUnlimited ? (
                        <strong>♾️ Access will be valid indefinitely (Unlimited)</strong>
                    ) : (
                        displayEndTime && (
                            <>
                                📅 Access will expire on: <strong>{displayEndTime.toLocaleString()}</strong>
                                <br />
                                ⏳ Expires in: <strong>{duration.hours}h {duration.minutes}m {duration.seconds}s</strong>
                            </>
                        )
                    )}
                </div>
                {error && <div className="error-alert bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 mt-4 mb-4">{error}</div>}
                <div className="form-actions mt-6 flex gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600 font-semibold py-3 px-4 rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {loading ? 'Processing...' : (initialData ? 'Update Consent' : 'Grant Consent')}
                    </button>
                </div>
            </form>
        </div>
    );
}
export default ConsentForm;
