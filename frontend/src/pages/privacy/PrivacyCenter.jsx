import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { privacyApi } from '../../api/privacyApi';
import Brand from '../../components/common/Brand';
import ThemeToggle from '../../components/common/ThemeToggle';
import RequestEvidence, { CompletionEvidence } from './RequestEvidence';
import { savePrivacyExport as saveExport } from './privacyDownload';
import './PrivacyCenter.css';

const TYPES = { access: 'Access to information', rectification: 'Correct information', erasure: 'Erasure review', restriction: 'Restrict processing', portability: 'Data portability', objection: 'Object to processing' };
const STATUS = { submitted: 'Submitted', in_review: 'In review', fulfilled: 'Fulfilled', partially_fulfilled: 'Partially fulfilled', retained: 'Retained with a basis', declined: 'Declined with a basis' };
const date = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
const errorText = (error, fallback) => error.response?.data?.message || fallback;
function ReviewForm({ request, onUpdated }) {
    const initial = request.status === 'submitted' ? 'in_review' : request.type === 'erasure' ? 'retained' : 'fulfilled';
    const [status, setStatus] = useState(initial);
    const [resolution, setResolution] = useState('');
    const [retentionBasis, setRetentionBasis] = useState('');
    const [note, setNote] = useState('');
    const [purpose, setPurpose] = useState('');
    const [recordId, setRecordId] = useState('');
    const [correction, setCorrection] = useState('');
    const [correctionTarget, setCorrectionTarget] = useState('record');
    const [profileField, setProfileField] = useState('date_of_birth');
    const [profileValue, setProfileValue] = useState('');
    const [receiptId, setReceiptId] = useState('');
    const [disposalIds, setDisposalIds] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const terminal = status !== 'in_review';
    const applies = ['fulfilled','partially_fulfilled'].includes(status);
    const action = applies && ['restriction','objection'].includes(request.type) ? {type:'restrict',purpose}
        : applies && request.type==='rectification' ? correctionTarget==='record' ? {type:'correction',recordId,text:correction} : {type:'profile_correction',changes:{[profileField]:profileValue}}
        : applies && ['access','portability'].includes(request.type) ? {type:'export_receipt',receiptId}
        : applies && request.type==='erasure' ? {type:'disposal_evidence',disposalIds} : null;
    const submit = async event => {
        event.preventDefault(); setError(''); setBusy(true);
        try { await privacyApi.update(request.id, { status, ...(terminal ? { resolution, retentionBasis } : {}), ...(note ? { note } : {}), ...(action ? {action} : {}) }); await onUpdated(); }
        catch (failure) { setError(errorText(failure, 'Unable to save this review. Please retry.')); }
        finally { setBusy(false); }
    };
    return <form className="privacy-review" onSubmit={submit} aria-label={`Review request ${request.id}`}>
        <label htmlFor={`status-${request.id}`}>Next review status</label>
        <select id={`status-${request.id}`} value={status} onChange={event => setStatus(event.target.value)}>
            {(request.status === 'submitted' ? ['in_review'] : ['fulfilled', 'partially_fulfilled', 'retained', 'declined'].filter(item => request.type !== 'erasure' || item !== 'fulfilled')).map(item => <option key={item} value={item}>{STATUS[item]}</option>)}
        </select>
        {terminal && <>
            {applies && <CompletionEvidence request={request} receiptId={receiptId} setReceiptId={setReceiptId} disposalIds={disposalIds} setDisposalIds={setDisposalIds} />}
            <label htmlFor={`resolution-${request.id}`}>Resolution and actions actually taken</label>
            <textarea id={`resolution-${request.id}`} value={resolution} onChange={event => setResolution(event.target.value)} required minLength={10} maxLength={10000} rows={3} />
            <label htmlFor={`basis-${request.id}`}>Decision or retention basis</label>
            <textarea id={`basis-${request.id}`} value={retentionBasis} onChange={event => setRetentionBasis(event.target.value)} required minLength={10} maxLength={4000} rows={2} />
            {action?.type==='restrict' && <><label htmlFor={`purpose-${request.id}`}>Processing purpose</label><select id={`purpose-${request.id}`} value={purpose} onChange={event=>setPurpose(event.target.value)} required>
                <option value="">Choose the processing to restrict</option>{['research','insurance','ai','messaging','treatment','all'].map(value=><option key={value} value={value}>{value}</option>)}</select>
                <p className="privacy-hint">This decision applies a server-enforced restriction. Patient access remains available; justified emergency access is separately audited.</p></>}
            {action?.type==='correction' && <><label htmlFor={`record-${request.id}`}>Patient medical record ID</label><input id={`record-${request.id}`} value={recordId} onChange={event=>setRecordId(event.target.value)} required />
                <label htmlFor={`correction-${request.id}`}>Reviewed patient-requested correction</label><textarea id={`correction-${request.id}`} value={correction} onChange={event=>setCorrection(event.target.value)} required minLength={10} maxLength={10000} rows={3} />
                <p className="privacy-hint">Append an attributed correction to this patient's record. The original clinical evidence remains intact.</p></>}
            {applies && request.type==='rectification' && <><label htmlFor={`correction-target-${request.id}`}>Correction target</label><select id={`correction-target-${request.id}`} value={correctionTarget} onChange={event=>setCorrectionTarget(event.target.value)}><option value="record">Clinical record addendum</option><option value="profile">Patient demographics</option></select></>}
            {action?.type==='profile_correction' && <><label htmlFor={`profile-field-${request.id}`}>Profile field</label><select id={`profile-field-${request.id}`} value={profileField} onChange={event=>setProfileField(event.target.value)}>{['date_of_birth','first_name','last_name','gender','address','city','state','country','postal_code'].map(field=><option key={field} value={field}>{field.replaceAll('_',' ')}</option>)}</select><label htmlFor={`profile-value-${request.id}`}>Corrected value</label><input id={`profile-value-${request.id}`} type={profileField==='date_of_birth'?'date':'text'} value={profileValue} onChange={event=>setProfileValue(event.target.value)} required /></>}
            <p className="privacy-hint">Record the actual outcome and applicable basis. Clinical records are not automatically deleted.</p>
        </>}
        <label htmlFor={`note-${request.id}`}>Review note (optional)</label>
        <textarea id={`note-${request.id}`} value={note} onChange={event => setNote(event.target.value)} minLength={10} maxLength={4000} rows={2} />
        {error && <p role="alert" className="privacy-error">{error}</p>}
        <button className="privacy-button" disabled={busy || (action?.type==='export_receipt' && !receiptId) || (action?.type==='disposal_evidence' && !disposalIds.length)}>{busy ? 'Saving review…' : 'Save review'}</button>
    </form>;
}
function RequestCard({ request, reviewer, onUpdated }) {
    const open = ['submitted', 'in_review'].includes(request.status);
    const overdue = open && new Date(request.dueAt).getTime() < Date.now();
    return <article className="privacy-request">
        <div className="privacy-request-heading"><div><span className="privacy-eyebrow">{reviewer ? request.patientName || 'Patient request' : 'Your request'}</span>
            <h3>{TYPES[request.type] || request.type}</h3></div><span className={`privacy-status ${overdue ? 'privacy-status-overdue' : ''}`}>{overdue ? 'Review overdue' : STATUS[request.status]}</span></div>
        <p className="privacy-request-details">{request.details}</p>
        <dl className="privacy-dates"><div><dt>Received</dt><dd><time dateTime={request.createdAt}>{date(request.createdAt)}</time></dd></div><div><dt>Review due</dt><dd><time dateTime={request.dueAt}>{date(request.dueAt)}</time></dd></div></dl>
        {request.outcome && <div className="privacy-outcome"><h4>Recorded decision</h4><p>{request.outcome.resolution}</p><p><strong>Basis:</strong> {request.outcome.retentionBasis}</p>{request.outcome.erasureScope && <p>{request.outcome.erasureScope}</p>}{request.outcome.appliedAction && !['export_receipt','disposal_evidence'].includes(request.outcome.appliedAction.type) && <p>Applied: {request.outcome.appliedAction.type} {request.outcome.appliedAction.type==='profile_correction' ? Object.keys(request.outcome.appliedAction.after).join(', ') : request.outcome.appliedAction.purpose || `for record ${request.outcome.appliedAction.recordId}`}</p>}</div>}
        <details className="privacy-history"><summary>Decision history ({request.history?.length || 0})</summary><ol>{(request.history || []).map(item => <li key={item.id}><strong>{STATUS[item.status]}</strong><time dateTime={item.createdAt}>{date(item.createdAt)}</time>{item.note && <p>{item.note}</p>}{item.outcome && <p>{item.outcome.resolution}<br />Basis: {item.outcome.retentionBasis}</p>}</li>)}</ol></details>
        <RequestEvidence request={request} reviewer={reviewer} onUpdated={onUpdated} />
        {reviewer && open && <ReviewForm key={`${request.id}-${request.status}`} request={request} onUpdated={onUpdated} />}
    </article>;
}
export default function PrivacyCenter() {
    const { user, logout } = useAuth();
    const reviewer = (user?.role || user?.roleName || '').toLowerCase() === 'compliance_officer';
    const dashboard = reviewer ? '/compliance/dashboard' : '/patient/dashboard';
    const [requests, setRequests] = useState([]);
    const [controls, setControls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [type, setType] = useState('access');
    const [details, setDetails] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [notice, setNotice] = useState('');
    const [password, setPassword] = useState('');
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const load = useCallback(async () => {
        setLoading(true); setLoadError('');
        try {
            if (reviewer) setRequests(await privacyApi.review());
            else { const [rows, active] = await Promise.all([privacyApi.requests(),privacyApi.controls()]); setRequests(rows); setControls(active); }
        }
        catch (failure) { setLoadError(errorText(failure, 'Unable to load privacy requests. Please retry.')); }
        finally { setLoading(false); }
    }, [reviewer]);
    useEffect(() => { load(); }, [load]);
    const submit = async event => {
        event.preventDefault(); setSubmitting(true); setSubmitError(''); setNotice('');
        try { await privacyApi.submit({ type, details }); setDetails(''); setNotice('Request submitted. Its review date and decision history appear below.'); await load(); }
        catch (failure) { setSubmitError(errorText(failure, 'Unable to submit your request. Please retry.')); }
        finally { setSubmitting(false); }
    };
    const exportData = async event => {
        event.preventDefault(); const confirmation = password; setPassword(''); setExporting(true); setExportError(''); setNotice('');
        try { saveExport(await privacyApi.exportData(confirmation)); setNotice('Your information download is ready. Keep the file in a private location.'); }
        catch (failure) { setExportError(errorText(failure, 'Unable to export your information. Please retry.')); }
        finally { setExporting(false); }
    };
    const releaseControl = async id => {
        setNotice(''); setSubmitError('');
        try { await privacyApi.releaseControl(id); setNotice('Restriction released. Any data sharing still requires valid consent and authorized care.'); await load(); }
        catch(failure) { setSubmitError(errorText(failure,'Unable to release the restriction. Please retry.')); }
    };
    return <div className="privacy-center mc-workspace">
        <header className="privacy-topbar"><Brand to={dashboard} /><nav aria-label="Privacy navigation"><Link to={dashboard}>Dashboard</Link><Link to={reviewer ? '/compliance/privacy' : '/patient/privacy'} aria-current="page">Privacy center</Link></nav><ThemeToggle /><button className="privacy-text-button" onClick={logout}>Sign out</button></header>
        <main className="privacy-content"><header className="privacy-page-heading"><span className="privacy-eyebrow">Information &amp; choice</span><h1>{reviewer ? 'Privacy requests' : 'Your privacy'}</h1><p>{reviewer ? 'Review patient requests, document the basis for each decision, and preserve its history.' : 'Ask for a review of your information, follow the decision, or download a structured copy.'}</p></header>
            <div className="privacy-policy-note"><span className="material-symbols-outlined" aria-hidden="true">policy</span><p>Requests receive an initial review target of one calendar month. Some clinical information must be retained. An erasure review records the actual decision and its basis; it does not automatically delete medical records.</p></div>
            <div className="privacy-policy-note"><p><Link to="/privacy-notice">Read privacy notice</Link>{reviewer?<> · <Link to="/compliance/notices">Manage notice publications</Link></>:<> and view your acknowledgement history. Acknowledgement is separate from medical-data consent.</>}</p></div>
            {notice && <p role="status" className="privacy-notice">{notice}</p>}
            {!reviewer && !!controls.length && <section className="privacy-panel"><h2>Active processing restrictions</h2><p>These restrictions are enforced separately from your consents.</p>{controls.map(control=><div key={control.id}><p>{control.purpose} processing restricted</p><button type="button" className="privacy-button" onClick={()=>releaseControl(control.id)}>Release {control.purpose} restriction</button></div>)}</section>}
            {!reviewer && <div className="privacy-actions-grid">
                <section className="privacy-panel"><span className="privacy-eyebrow">01 / Make a request</span><h2>Tell us what needs review</h2><form onSubmit={submit}>
                    <label htmlFor="privacy-type">Request type</label><select id="privacy-type" value={type} onChange={event => setType(event.target.value)}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                    <label htmlFor="privacy-details">What would you like us to review?</label><textarea id="privacy-details" value={details} onChange={event => setDetails(event.target.value)} required minLength={10} maxLength={10000} rows={5} aria-describedby="privacy-details-help" />
                    <p id="privacy-details-help" className="privacy-hint">Describe the information and the change or review you need. Include relevant record dates. Do not include passwords.</p>
                    {submitError && <p role="alert" className="privacy-error">{submitError}</p>}<button className="privacy-button" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</button>
                </form></section>
                <section className="privacy-panel privacy-export"><span className="privacy-eyebrow">02 / Take a copy</span><h2>Your information, together</h2><p>Download a structured JSON copy of the information linked to your patient account.</p><ul><li>Clinical records, visit notes, medication orders and administration, and laboratory and radiology reports.</li><li>Your profile, visits, insurance, consents, triage, privacy requests, and access history.</li><li>Includes all rows with verified ownership in those categories. Attachments remain separate authenticated downloads.</li><li>Credentials, other patients’ information, and entries with inconsistent ownership links are excluded.</li></ul>
                    <form onSubmit={exportData}><label htmlFor="privacy-password">Current password</label><input id="privacy-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={1024} aria-describedby="privacy-password-help" /><p id="privacy-password-help" className="privacy-hint">Confirm your password for this download. It is cleared after you submit.</p>
                        {exportError && <p role="alert" className="privacy-error">{exportError}</p>}<button className="privacy-button" disabled={exporting}>{exporting ? 'Preparing your copy…' : 'Download my information'}</button></form>
                </section></div>}
            <section className="privacy-request-list" aria-labelledby="privacy-history-heading"><div className="privacy-list-heading"><div><span className="privacy-eyebrow">A record of each decision</span><h2 id="privacy-history-heading">{reviewer ? 'Review queue' : 'Your requests'}</h2></div><button className="privacy-text-button" onClick={load} disabled={loading}>Refresh</button></div>
                {loading && <p role="status">Loading requests…</p>}{loadError && <p role="alert" className="privacy-error">{loadError}</p>}{!loading && !loadError && requests.length === 0 && <div className="privacy-empty">{reviewer ? 'No privacy requests are awaiting review or on record.' : 'No privacy requests yet.'}</div>}
                {requests.map(request => <RequestCard key={request.id} request={request} reviewer={reviewer} onUpdated={load} />)}
            </section>
        </main>
    </div>;
}
