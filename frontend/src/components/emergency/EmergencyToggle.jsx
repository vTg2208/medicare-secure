import React, { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import './EmergencyToggle.css';

function EmergencyToggle({ onToggle }) {
    const [grants, setGrants] = useState([]);
    const [patientId, setPatientId] = useState('');
    const [justification, setJustification] = useState('');
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        apiClient.get('/emergency/active', { signal: controller.signal }).then(response => setGrants(response.data.data))
            .catch(err => { if (err.code !== 'ERR_CANCELED') setError('Could not load emergency access status'); });
        return () => controller.abort();
    }, []);
    const activate = async event => {
        event.preventDefault(); setLoading(true); setError('');
        try {
            const response = await apiClient.post('/emergency/activate', { patientId, justification });
            setGrants(previous => [...previous, response.data.data]);
            onToggle?.(true); setOpen(false); setJustification('');
        } catch (err) { setError(err.response?.data?.message || 'Emergency access could not be activated'); }
        finally { setLoading(false); }
    };
    const revoke = async id => {
        setLoading(true); setError('');
        try {
            await apiClient.post(`/emergency/${id}/revoke`);
            setGrants(previous => previous.filter(grant => grant.id !== id));
            onToggle?.(false);
        } catch (err) { setError(err.response?.data?.message || 'Emergency access could not be revoked'); }
        finally { setLoading(false); }
    };
    return <div className="space-y-3">
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="button" onClick={() => setOpen(value => !value)} className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-xs">
            Request emergency record access
        </button>
        {open && <form onSubmit={activate} className="space-y-3 text-sm">
            <p>Read access lasts up to 60 minutes for one patient with an active visit at your facility. The patient receives an in-app notification and the event is sent for compliance review.</p>
            <label className="block">Patient ID<input required value={patientId} onChange={event => setPatientId(event.target.value.trim())} className="block w-full border rounded p-2 bg-transparent" /></label>
            <label className="block">Emergency justification<textarea required minLength={20} maxLength={2000} value={justification} onChange={event => setJustification(event.target.value)} className="block w-full border rounded p-2 bg-transparent" /></label>
            <button disabled={loading} className="px-4 py-2 rounded bg-red-600 text-white">{loading ? 'Submitting…' : 'Activate audited read access'}</button>
        </form>}
        {grants.filter(grant => new Date(grant.expires_at) > new Date()).map(grant => <div key={grant.id} className="text-xs border rounded p-3">
            <p>Patient {grant.patient_id}</p><p>Expires {new Date(grant.expires_at).toLocaleString()}</p>
            <button disabled={loading} type="button" onClick={() => revoke(grant.id)} className="underline">Revoke access</button>
        </div>)}
    </div>;
}
export default EmergencyToggle;
