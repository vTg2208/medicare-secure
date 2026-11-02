import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { privacyApi } from '../../api/privacyApi';
import { savePrivacyExport } from './privacyDownload';

const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
const message = (error, fallback) => error.response?.data?.message || fallback;
export const completedDisposals = request => (request.evidence?.disposals || []).filter(item => item.status === 'completed' && item.executedAt && item.pendingAttachments === 0);

export function CompletionEvidence({ request, receiptId, setReceiptId, disposalIds, setDisposalIds }) {
    if (['access', 'portability'].includes(request.type)) return <>
        <label htmlFor={`receipt-${request.id}`}>Confirmed export receipt</label>
        <select id={`receipt-${request.id}`} value={receiptId} onChange={event => setReceiptId(event.target.value)} required>
            <option value="">Choose a patient-confirmed copy</option>
            {(request.evidence?.exports || []).filter(item => item.confirmedAt).map(item => <option key={item.id} value={item.id}>Prepared {date(item.preparedAt)} · {item.id.slice(0, 8)}</option>)}
        </select>
        <p className="privacy-hint">This receipt covers the structured copy. Review its exclusions and the requested scope. Attachments and other delivery channels require their own evidence; record partial fulfillment if they remain outstanding.</p>
    </>;
    if (request.type === 'erasure') return <fieldset><legend>Completed disposal evidence</legend>
        {completedDisposals(request).map(item => <label key={item.id}><input type="checkbox" aria-label={`Use completed disposal ${item.disposalId}`} checked={disposalIds.includes(item.disposalId)} onChange={event => setDisposalIds(event.target.checked ? [...disposalIds, item.disposalId] : disposalIds.filter(id => id !== item.disposalId))} /> {item.resourceType.replaceAll('_', ' ')} · {item.resourceId} · {date(item.executedAt)}</label>)}
        {!completedDisposals(request).length && <p>No linked disposals have completed all cleanup.</p>}
        <p className="privacy-hint">Describe the limited resources removed and what remains. This cannot establish complete account or backup erasure.</p>
    </fieldset>;
    return null;
}

export default function RequestEvidence({ request, reviewer, onUpdated }) {
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [disposalId, setDisposalId] = useState('');
    const [explanation, setExplanation] = useState('');
    const copies = request.evidence?.exports || [];
    const disposals = request.evidence?.disposals || [];
    const open = request.status === 'in_review';
    const copyCase = ['access', 'portability'].includes(request.type);
    const run = async (action, success) => {
        setBusy(true); setError(''); setNotice('');
        try { await action(); setNotice(success); await onUpdated(); }
        catch (failure) { setError(message(failure, 'Unable to save fulfillment evidence. Refresh the request and retry.')); }
        finally { setBusy(false); }
    };
    const download = event => {
        event.preventDefault(); const confirmation = password; setPassword('');
        return run(async () => {
            const result = await privacyApi.exportRequest(request.id, confirmation);
            savePrivacyExport(result.data);
        }, 'Your request copy is ready. Confirm receipt only after you receive it.');
    };
    const link = event => {
        event.preventDefault();
        return run(async () => { await privacyApi.linkDisposal(request.id, { disposalId, explanation }); setDisposalId(''); setExplanation(''); }, 'Disposal evidence linked. Linking does not execute deletion.');
    };
    if (!copyCase && request.type !== 'erasure') return null;
    const missing = ['fulfilled', 'partially_fulfilled'].includes(request.status) && !['export_receipt', 'disposal_evidence'].includes(request.outcome?.appliedAction?.type);
    return <section aria-label="Request fulfillment evidence">
        <h4>Fulfillment evidence</h4>
        {missing && <p>This historical decision has no linked fulfillment evidence.</p>}
        {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="privacy-error">{error}</p>}
        {copyCase && <>
            {!reviewer && open && <form onSubmit={download}>
                <label htmlFor={`request-password-${request.id}`}>Current password for this request</label>
                <input id={`request-password-${request.id}`} type="password" autoComplete="current-password" maxLength={1024} required value={password} onChange={event => setPassword(event.target.value)} />
                <button className="privacy-button" disabled={busy}>Download a copy for this request</button>
            </form>}
            {!copies.length && <p>No request-linked copy has been prepared.</p>}
            <ul>{copies.map(item => <li key={item.id}>
                <p>Copy prepared <time dateTime={item.preparedAt}>{date(item.preparedAt)}</time> · {item.byteLength} bytes</p>
                <p>{item.confirmedAt ? `${reviewer ? 'Patient confirmed receipt' : 'Receipt confirmed by you'}: ${date(item.confirmedAt)}` : 'Copy prepared; receipt not confirmed'}</p>
                <details><summary>Copy scope and provenance</summary><p>{item.scope}</p><ul>{(item.exclusions || []).map(value => <li key={value}>{value}</li>)}</ul><p>SHA-256: <code>{item.contentHash}</code></p></details>
                {!reviewer && open && !item.confirmedAt && <button className="privacy-button" disabled={busy} onClick={() => run(() => privacyApi.confirmReceipt(request.id, item.id, item.contentHash), 'Receipt confirmation recorded.')}>I received this copy</button>}
            </li>)}</ul>
            {!reviewer && copies.some(item => !item.confirmedAt) && <p className="privacy-hint">Confirm only a copy you received. If you no longer have it, prepare a new copy while this request is in review. Confirmation records your assertion of receipt, not that you read or saved every item.</p>}
        </>}
        {request.type === 'erasure' && <>
            {reviewer && open && <form onSubmit={link}>
                <p><Link to="/compliance/retention">Review retention and disposal decisions</Link></p>
                <label htmlFor={`disposal-${request.id}`}>Disposal decision ID</label><input id={`disposal-${request.id}`} value={disposalId} onChange={event => setDisposalId(event.target.value)} required maxLength={36} />
                <label htmlFor={`disposal-scope-${request.id}`}>Scope addressed by this disposal</label><textarea id={`disposal-scope-${request.id}`} value={explanation} onChange={event => setExplanation(event.target.value)} minLength={10} maxLength={4000} required />
                <p className="privacy-hint">This explanation is visible to the patient. Do not include internal review notes. Execution remains a separate authorized operator action.</p>
                <button className="privacy-button" disabled={busy}>Link disposal evidence</button>
            </form>}
            {!disposals.length && <p>No disposal evidence linked.</p>}
            <ul>{disposals.map(item => <li key={item.id}><p>{item.resourceType.replaceAll('_', ' ')} · {item.resourceId}</p><p>{item.explanation}</p><p>State: {item.status.replaceAll('_', ' ')} · Pending attachment cleanup: {item.pendingAttachments}</p>{item.executedAt && <p>Executed: {date(item.executedAt)}</p>}</li>)}</ul>
        </>}
        {['export_receipt', 'disposal_evidence'].includes(request.outcome?.appliedAction?.type) && <div>
            <h4>Evidence used for this decision</h4>
            {request.outcome.appliedAction.receipt && <p>Confirmed copy: {request.outcome.appliedAction.receipt.id}</p>}
            {request.outcome.appliedAction.disposals && <ul>{request.outcome.appliedAction.disposals.map(item => <li key={item.disposalId}>{item.resourceType.replaceAll('_', ' ')} · {item.resourceId} · executed {date(item.executedAt)}</li>)}</ul>}
            <p>{request.outcome.appliedAction.scope}</p>
        </div>}
    </section>;
}
