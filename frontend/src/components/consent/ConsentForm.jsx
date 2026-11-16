import React, { useState, useEffect } from 'react';
import Input from '../common/Input';
import { consentApi } from '../../api/consentApi';
import './ConsentForm.css';

const durationPresets = {
    '1-hour': { hours: 1, minutes: 0, seconds: 0 },
    '24-hours': { hours: 24, minutes: 0, seconds: 0 },
    '7-days': { hours: 168, minutes: 0, seconds: 0 },
};

function ConsentForm({ onSuccess, onCancel, initialData }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [doctors, setDoctors] = useState([]);
    const [duration, setDuration] = useState({ hours: 0, minutes: 0, seconds: 0 });
    const [durationChoice, setDurationChoice] = useState('unlimited');
    const [timeRangeChanged, setTimeRangeChanged] = useState(false);
    const [formData, setFormData] = useState({
        recipientUserId: '',
        dataCategory: 'all_medical_data',
        purpose: 'treatment',
        accessLevel: 'read',
        startTime: new Date().toISOString().split('T')[0],
        endTime: '',
    });

    const isUnlimited = durationChoice === 'unlimited';
    const effectiveDuration = durationPresets[durationChoice] || duration;
    const totalSeconds = effectiveDuration.hours * 3600 + effectiveDuration.minutes * 60 + effectiveDuration.seconds;

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
            setTimeRangeChanged(false);

            if (initialData.endTime) {
                const total = Math.max(0, (new Date(initialData.endTime) - new Date(initialData.startTime)) / 1000);
                const hours = Math.floor(total / 3600);
                const minutes = Math.floor((total / 60) % 60);
                const seconds = Math.floor(total % 60);
                setDuration({ hours, minutes, seconds });
                const preset = Object.keys(durationPresets).find(key => durationPresets[key].hours * 3600 === total);
                setDurationChoice(preset || 'custom');
            } else {
                setDuration({ hours: 0, minutes: 0, seconds: 0 });
                setDurationChoice('unlimited');
            }
        }
    }, [initialData]);

    // Keep an existing grant's exact timestamps until the patient changes its time range.
    const calculateTimeRange = () => {
        if (initialData && !timeRangeChanged) {
            return { startTime: initialData.startTime, endTime: initialData.endTime || null };
        }
        if (isUnlimited) return { startTime: formData.startTime, endTime: null };
        if (totalSeconds <= 0) return { startTime: formData.startTime, endTime: null };

        const now = new Date();
        const inputDate = new Date(formData.startTime);
        if (Number.isNaN(inputDate.getTime())) return { startTime: formData.startTime, endTime: null };
        const todayDate = new Date(now.toISOString().split('T')[0]);

        const startDate = inputDate.getTime() <= todayDate.getTime() ? now : inputDate;
        return {
            startTime: startDate === now ? now.toISOString() : formData.startTime,
            endTime: new Date(startDate.getTime() + totalSeconds * 1000).toISOString(),
        };
    };

    const previewEndTime = !isUnlimited && totalSeconds > 0 ? calculateTimeRange().endTime : null;
    const displayEndTime = previewEndTime ? new Date(previewEndTime) : null;

    const handleDurationChange = (e) => {
        const { name, value } = e.target;
        setTimeRangeChanged(true);
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
        if (name === 'startTime') setTimeRangeChanged(true);
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!isUnlimited && totalSeconds <= 0) {
            setError('Enter a custom duration greater than zero, or choose Unlimited.');
            return;
        }
        setLoading(true);

        try {
            const submitData = { ...formData, ...calculateTimeRange() };

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
        <div className="bg-surface dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 md:p-8 mb-6">
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
                        <label htmlFor="consentDuration" className="dark:text-gray-300">Duration</label>
                        <select
                            id="consentDuration"
                            value={durationChoice}
                            onChange={e => {
                                setDurationChoice(e.target.value);
                                setTimeRangeChanged(true);
                            }}
                            className="form-select dark:bg-slate-700 dark:text-white dark:border-slate-600"
                        >
                            <option value="1-hour">1 hour</option>
                            <option value="24-hours">24 hours</option>
                            <option value="7-days">7 days</option>
                            <option value="unlimited">Unlimited</option>
                            <option value="custom">Custom duration</option>
                        </select>
                        {durationChoice === 'custom' && (
                            <div className="duration-container consent-duration-fields" role="group" aria-label="Custom duration">
                                {['hours', 'minutes', 'seconds'].map(unit => (
                                    <div className="duration-field" key={unit}>
                                        <input
                                            id={`consent-duration-${unit}`}
                                            type="number"
                                            name={unit}
                                            placeholder="0"
                                            value={duration[unit] || ''}
                                            onChange={handleDurationChange}
                                            min="0"
                                            max={unit === 'hours' ? undefined : 59}
                                            className="dark:bg-slate-700 dark:text-white dark:border-slate-600 rounded-md border"
                                        />
                                        <label htmlFor={`consent-duration-${unit}`} className="text-xs text-center dark:text-gray-400 mt-1">
                                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Expiry Message */}
                <div className="info-alert consent-duration-summary" aria-live="polite" style={{ marginTop: '-10px', marginBottom: '15px' }}>
                    {isUnlimited ? (
                        <strong>♾️ Access will be valid indefinitely (Unlimited)</strong>
                    ) : displayEndTime ? (
                        <>
                            📅 Access will expire on: <strong>{displayEndTime.toLocaleString()}</strong>
                            <br />
                            ⏳ Access duration: <strong>{effectiveDuration.hours}h {effectiveDuration.minutes}m {effectiveDuration.seconds}s</strong>
                        </>
                    ) : (
                        <span>{totalSeconds > 0 ? 'Choose a start date to see the expiry.' : 'Enter a duration greater than zero to set an expiry.'}</span>
                    )}
                </div>
                {error && <div role="alert" className="error-alert bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 mt-4 mb-4">{error}</div>}
                <div className="form-actions mt-6 flex gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 bg-surface dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600 font-semibold py-3 px-4 rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 text-white font-semibold py-3 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:translate-y-0 bg-primary-600"
                    >
                        {loading ? 'Processing...' : (initialData ? 'Update Consent' : 'Grant Consent')}
                    </button>
                </div>
            </form>
        </div>
    );
}
export default ConsentForm;
