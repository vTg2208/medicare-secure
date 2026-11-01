import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import ThemeToggle from '../../components/common/ThemeToggle';

const initial = () => ({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', weekdays: [1,2,3,4,5], startTime: '09:00', endTime: '17:00', slotMinutes: 30 });
export default function AppointmentCalendar() {
    const [doctors, setDoctors] = useState([]);
    const [chosen, setChosen] = useState('');
    const [form, setForm] = useState(initial);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let active = true;
        apiClient.get('/users/doctors', { params: { limit: 500 } }).then(response => {
            if (active) setDoctors(response.data.data.filter(doctor => doctor.organization_id));
        }).catch(() => { if (active) setError('Unable to load doctor calendars. Reload this page to retry.'); });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!chosen) return;
        let active = true;
        const doctor = doctors.find(item => `${item.id}:${item.organization_id}` === chosen);
        if (!doctor) return;
        setLoading(true); setReady(false); setError(''); setNotice('');
        apiClient.get('/appointments/calendar', { params: { doctorId: doctor.id, organizationId: doctor.organization_id } }).then(response => {
            if (!active) return;
            const calendar = response.data.data;
            setReady(true);
            setForm(calendar ? { timeZone: calendar.time_zone, weekdays: calendar.weekdays, startTime: calendar.start_time.slice(0,5), endTime: calendar.end_time.slice(0,5), slotMinutes: calendar.slot_minutes } : initial());
            setNotice(calendar ? 'Loaded published clinic hours.' : 'No published hours. The values below are unsaved defaults; no slots appear until you save.');
        }).catch(failure => { if (active) setError(failure.response?.data?.message || 'Unable to load this calendar.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [chosen, doctors]);
    const save = async event => {
        event.preventDefault(); setBusy(true); setError(''); setNotice('');
        const doctor = doctors.find(item => `${item.id}:${item.organization_id}` === chosen);
        try {
            await apiClient.put('/appointments/calendar', { ...form, doctorId: doctor.id, organizationId: doctor.organization_id });
            setNotice('Clinic hours saved. Existing appointments remain reserved.');
        } catch (failure) { setError(failure.response?.data?.message || 'Unable to save clinic hours. Please retry.'); }
        finally { setBusy(false); }
    };
    const field = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
    return <main className="max-w-3xl mx-auto p-6 mc-workspace bg-canvas min-h-screen">
        <header className="flex justify-between mb-6"><Link to="/admin/dashboard">Administration</Link><ThemeToggle /></header>
        <h1 className="text-2xl font-bold mb-3">Appointment calendars</h1><p>Publish recurring clinic hours for a doctor. Only administrators of the selected clinic can change them.</p>
        {error && <p role="alert" className="my-4">{error}</p>}{notice && <p role="status" className="my-4">{notice}</p>}
        <form onSubmit={save} className="space-y-4 mt-6">
            <label className="block">Doctor and clinic<select aria-label="Doctor and clinic" value={chosen} onChange={event => setChosen(event.target.value)} required disabled={busy} className="block w-full p-3 bg-surface border border-line rounded-lg">
                <option value="">Choose a doctor and clinic</option>{doctors.map(doctor => <option key={`${doctor.id}:${doctor.organization_id}`} value={`${doctor.id}:${doctor.organization_id}`}>Dr. {doctor.firstName} {doctor.lastName} — {doctor.organization_name}</option>)}
            </select></label>
            <fieldset disabled={!chosen || busy || loading || !ready} className="space-y-4">
                <label className="block">Clinic time zone<input name="timeZone" value={form.timeZone} onChange={field} required className="block w-full p-3 bg-surface border border-line rounded-lg" /></label>
                <fieldset><legend>Clinic weekdays</legend><div className="flex flex-wrap gap-4 mt-2">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,index) => <label key={day}><input type="checkbox" checked={form.weekdays.includes(index+1)} onChange={event => setForm(current => ({ ...current, weekdays: event.target.checked ? [...current.weekdays,index+1] : current.weekdays.filter(value => value!==index+1) }))} /> {day}</label>)}</div></fieldset>
                <div className="flex gap-6"><label>Opens<input type="time" name="startTime" value={form.startTime} onChange={field} required className="block p-3 bg-surface border border-line rounded-lg" /></label>
                    <label>Closes<input type="time" name="endTime" value={form.endTime} onChange={field} required className="block p-3 bg-surface border border-line rounded-lg" /></label></div>
                <label className="block">Appointment duration<select value={form.slotMinutes} onChange={event => setForm(current => ({ ...current, slotMinutes: Number(event.target.value) }))} className="block p-3 bg-surface border border-line rounded-lg">{[15,30,60].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
                <button className="px-5 py-3 rounded-lg bg-primary-600 text-white disabled:opacity-50" disabled={!form.weekdays.length}>Save clinic hours</button>
            </fieldset>
        </form>
    </main>;
}
