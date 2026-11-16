import React, { useCallback, useEffect, useRef, useState, useId } from 'react';
import apiClient from '../../api/client';
import FlowSteps from '../common/FlowSteps';
import BookingDialog from './BookingDialog';

export default function DoctorProfilePopup({ doctor, onBack, onBook, initialAppointment, returnFocusRef }) {
    const id = useId();
    const [date, setDate] = useState(() => {
        if (initialAppointment && initialAppointment.doctorId === doctor?.id && initialAppointment.date) return initialAppointment.date;
        const now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    });
    const [slots, setSlots] = useState([]);
    const [timeZone, setTimeZone] = useState('');
    const [chosen, setChosen] = useState(initialAppointment && initialAppointment.doctorId === doctor?.id ? initialAppointment.scheduledTime || '' : '');
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const revision = useRef(0);
    const organizationId = doctor?.organization_id || doctor?.organizationId;
    const load = useCallback(async () => {
        const version = ++revision.current;
        setLoading(true); setError(''); setSlots([]);
        try {
            if (!organizationId) throw new Error('This doctor has no active clinic.');
            const response = await apiClient.get('/appointments/availability', { params: { doctorId: doctor.id, organizationId, date } });
            if (version !== revision.current) return;
            const available = response.data.data.slots;
            setSlots(available); setTimeZone(response.data.data.timeZone || '');
            setChosen(current => available.some(slot => slot.startsAt === current) ? current : '');
        } catch (failure) { if (version === revision.current) setError(failure.response?.data?.message || 'Unable to load availability. Please retry.'); }
        finally { if (version === revision.current) setLoading(false); }
    }, [doctor?.id, organizationId, date]);
    const invalidate = useCallback(() => { revision.current++; }, []);
    useEffect(() => { load(); return invalidate; }, [load, invalidate]);
    const label = instant => new Intl.DateTimeFormat('en', { timeZone: timeZone || 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(instant));
    const bookingDetails = { doctorId: doctor?.id, organizationId, scheduledTime: chosen, date, timeZone };
    const back = () => onBack(bookingDetails);
    const visibleSlots = expanded ? slots : slots.filter((slot, index) => index < 6 || slot.startsAt === chosen);
    if (!doctor) return null;
    return <BookingDialog labelledBy={`${id}-heading`} onDismiss={back} returnFocusRef={returnFocusRef}>
            <button type="button" onClick={back} className="mb-6 px-3 py-2 border border-line rounded-lg">Back to doctors</button>
            <FlowSteps label="Booking progress" steps={[{ label: 'Doctor' }, { label: 'Appointment' }, { label: 'Request' }]} currentStep={1} />
            <h2 id={`${id}-heading`} className="text-2xl font-bold mt-6">Appointment availability</h2>
            <p className="mt-2">Dr. {doctor.firstName} {doctor.lastName} · {doctor.specialization || 'General practice'}</p>
            {doctor.organization_name && <p>{doctor.organization_name}</p>}
            <label htmlFor={`${id}-date`} className="block mt-6 mb-2 font-semibold">Clinic date</label>
            <input id={`${id}-date`} type="date" value={date} onChange={event => { setDate(event.target.value); setChosen(''); setExpanded(false); }} required className="max-w-full p-3 border border-line rounded-lg bg-surface" />
            {timeZone && <p className="my-3">Times shown in {timeZone}.</p>}
            {loading && <p role="status" className="my-4">Loading clinic availability…</p>}
            {error && <div role="alert" className="my-4">{error} <button type="button" onClick={load}>Retry</button></div>}
            {!loading && !error && !slots.length && <p className="my-4">No available appointments on this date.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
                {visibleSlots.map(slot => <button type="button" key={slot.startsAt} aria-pressed={chosen === slot.startsAt} onClick={() => setChosen(slot.startsAt)}
                    className={'p-3 rounded-lg border ' + (chosen === slot.startsAt ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'border-line bg-surface')}>{label(slot.startsAt)}</button>)}
            </div>
            {!loading && !error && slots.length > 6 && <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="mb-5 px-4 py-2 border border-line rounded-lg">{expanded ? 'Show fewer appointments' : `Show all ${slots.length} appointments`}</button>}
            {chosen && !loading && !error && <p className="mb-4 font-semibold mc-booking-summary">Selected appointment: {date} at {label(chosen)} ({timeZone || 'UTC'}).</p>}
            <p className="mb-4 text-sm">The time is reserved when you submit the visit request. Clinic approval and patient data-access approval remain separate.</p>
            <button type="button" disabled={!chosen || loading || Boolean(error)} onClick={() => onBook(bookingDetails)}
                className="px-5 py-3 rounded-lg bg-primary-600 text-white disabled:opacity-50">Use selected appointment</button>
    </BookingDialog>;
}
