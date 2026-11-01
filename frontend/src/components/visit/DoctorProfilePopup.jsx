import React, { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../../api/client';

export default function DoctorProfilePopup({ doctor, onBack, onBook }) {
    const [date, setDate] = useState(() => {
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    });
    const [slots, setSlots] = useState([]);
    const [timeZone, setTimeZone] = useState('');
    const [chosen, setChosen] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const revision = useRef(0);
    const organizationId = doctor?.organization_id || doctor?.organizationId;
    const load = useCallback(async () => {
        const version = ++revision.current;
        setLoading(true); setError(''); setChosen(''); setSlots([]);
        try {
            if (!organizationId) throw new Error('This doctor has no active clinic.');
            const response = await apiClient.get('/appointments/availability', { params: { doctorId: doctor.id, organizationId, date } });
            if (version !== revision.current) return;
            setSlots(response.data.data.slots); setTimeZone(response.data.data.timeZone || '');
        } catch (failure) { if (version === revision.current) setError(failure.response?.data?.message || 'Unable to load availability. Please retry.'); }
        finally { if (version === revision.current) setLoading(false); }
    }, [doctor?.id, organizationId, date]);
    const invalidate = useCallback(() => { revision.current++; }, []);
    useEffect(() => { load(); return invalidate; }, [load, invalidate]);
    const label = instant => new Intl.DateTimeFormat('en', { timeZone: timeZone || 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(instant));
    if (!doctor) return null;
    return <div className="fixed inset-0 z-[70] bg-canvas overflow-auto p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="appointment-heading" className="max-w-2xl mx-auto my-8 p-6 bg-surface border border-line rounded-2xl">
            <button type="button" onClick={onBack} className="mb-6">Back to doctors</button>
            <h2 id="appointment-heading" className="text-2xl font-bold">Appointment availability</h2>
            <p className="mt-2">Dr. {doctor.firstName} {doctor.lastName} · {doctor.specialization || 'General practice'}</p>
            {doctor.organization_name && <p>{doctor.organization_name}</p>}
            <label htmlFor="appointment-date" className="block mt-6 mb-2 font-semibold">Clinic date</label>
            <input id="appointment-date" type="date" value={date} onChange={event => setDate(event.target.value)} required className="p-3 border border-line rounded-lg bg-surface" />
            {timeZone && <p className="my-3">Times shown in {timeZone}.</p>}
            {loading && <p role="status" className="my-4">Loading clinic availability…</p>}
            {error && <div role="alert" className="my-4">{error} <button type="button" onClick={load}>Retry</button></div>}
            {!loading && !error && !slots.length && <p className="my-4">No available appointments on this date.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
                {slots.map(slot => <button type="button" key={slot.startsAt} aria-pressed={chosen === slot.startsAt} onClick={() => setChosen(slot.startsAt)}
                    className={'p-3 rounded-lg border ' + (chosen === slot.startsAt ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-line bg-surface')}>{label(slot.startsAt)}</button>)}
            </div>
            <p className="mb-4 text-sm">The time is reserved when you submit the visit request. Clinic approval and patient data-access approval remain separate.</p>
            <button type="button" disabled={!chosen || loading || Boolean(error)} onClick={() => onBook({ doctorId: doctor.id, organizationId, scheduledTime: chosen, date, timeZone })}
                className="px-5 py-3 rounded-lg bg-primary-600 text-white disabled:opacity-50">Use selected appointment</button>
        </section>
    </div>;
}
