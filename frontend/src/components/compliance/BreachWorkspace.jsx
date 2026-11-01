import React, { useEffect, useId, useState } from 'react';
import { breachApi } from '../../api/breachApi';
import './BreachWorkspace.css';

const blank = () => ({ discoveredAt:new Date().toISOString().slice(0,16), regimes:['gdpr','hipaa'], severity:'high',
    gdprRole:'controller',hipaaRole:'covered_entity',riskLevel:'unknown',hipaaDetermination:'pending',mediaDecision:'pending',
    affectedCount:'',facts:'',consequences:'',measures:'',contact:'',rationale:'',hipaaFactors:'' });
const date = value => value ? new Date(value).toLocaleString() : 'Without undue delay';
const label = value => value.replaceAll('_',' ');
const message = error => error.response?.data?.message || 'Unable to save. Please try again.';

function AssessmentForm({ current, onSaved, onCancel }) {
    const [form,setForm] = useState(() => current ? {...current.assessment,discoveredAt:current.assessment.discoveredAt.slice(0,16),affectedCount:current.assessment.affectedCount ?? ''} : blank());
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState('');
    const prefix = useId();
    const update = event => setForm({...form,[event.target.name]:event.target.value});
    const text = (name,title,hint) => <div className="mc-breach-field"><label htmlFor={`${prefix}-${name}`}>{title}</label><textarea id={`${prefix}-${name}`} aria-describedby={hint?`${prefix}-${name}-help`:undefined} name={name} value={form[name]} onChange={update} required minLength="10" maxLength="4000" rows="3" />{hint && <small id={`${prefix}-${name}-help`}>{hint}</small>}</div>;
    const select = (name,title,options) => <label htmlFor={`${prefix}-${name}`}>{title}<select id={`${prefix}-${name}`} name={name} value={form[name]} onChange={update}>{options.map(([value,caption])=><option key={value} value={value}>{caption}</option>)}</select></label>;
    const submit = async event => {
        event.preventDefault(); setError(''); setBusy(true);
        try {
            const body={...form,discoveredAt:new Date(`${form.discoveredAt}Z`).toISOString(),affectedCount:form.affectedCount === '' ? null:Number(form.affectedCount),expectedVersion:current?.version};
            const saved=current ? await breachApi.assess(current.id,body) : await breachApi.create(body);
            await onSaved(saved);
        } catch (err) { setError(message(err)); } finally { setBusy(false); }
    };
    return <form onSubmit={submit} className="mc-breach-form" aria-label={current ? 'Reassess breach' : 'Record potential breach'}>
        <h3>{current ? 'Update assessment' : 'Record a potential breach'}</h3>
        <p>Document facts and decisions without patient names, identifiers, or copied clinical records. Notification reminders support review; they do not replace a jurisdiction-specific response plan.</p>
        {error && <p role="alert" className="mc-breach-error">{error}</p>}
        <div className="mc-breach-fields">
            <div className="mc-breach-field"><label htmlFor={`${prefix}-discovered`}>Awareness / discovery (UTC)</label><input id={`${prefix}-discovered`} aria-describedby={`${prefix}-discovered-help`} type="datetime-local" name="discoveredAt" value={form.discoveredAt} onChange={update} required /><small id={`${prefix}-discovered-help`}>Use the earliest known awareness time. Reassessment cannot move it forward.</small></div>
            <div className="mc-breach-field"><label htmlFor={`${prefix}-count`}>Affected individuals</label><input id={`${prefix}-count`} aria-describedby={`${prefix}-count-help`} type="number" name="affectedCount" min="0" step="1" value={form.affectedCount} onChange={update} placeholder="Unknown" /><small id={`${prefix}-count-help`}>Leave blank while the count is unknown.</small></div>
        </div>
        <fieldset><legend>Frameworks assessed</legend>{['gdpr','hipaa'].map(regime=><label key={regime} className="mc-breach-check"><input type="checkbox" checked={form.regimes.includes(regime)} onChange={event=>setForm({...form,regimes:event.target.checked ? [...form.regimes,regime]:form.regimes.filter(value=>value!==regime)})} />{regime.toUpperCase()}</label>)}</fieldset>
        {form.regimes.includes('gdpr') && <div className="mc-breach-fields">{select('gdprRole','GDPR responsibility',[['controller','Controller'],['processor','Processor']])}{select('riskLevel','Risk to individuals',[['unknown','Assessment pending'],['unlikely','Risk is unlikely'],['risk','Risk identified'],['high','High risk identified']])}</div>}
        {form.regimes.includes('hipaa') && <>
            <div className="mc-breach-fields">{select('hipaaRole','HIPAA responsibility',[['covered_entity','Covered entity'],['business_associate','Business associate']])}{select('hipaaDetermination','HIPAA breach determination',[['pending','Assessment pending'],['notifiable','Notifiable breach'],['not_notifiable','Notification not required — document basis']])}</div>
            {select('mediaDecision','Media notice assessment',[['pending','Assessment pending'],['required','Required'],['not_required','Not required — document basis']])}
            <small>Assess residents affected in each state or jurisdiction; total count alone does not determine media notice.</small>
            {text('hipaaFactors','Four-factor risk assessment','Address the information/identifiers involved, unauthorized recipient, whether information was acquired/viewed, and mitigation.')}
        </>}
        {text('facts','Nature and facts')}{text('consequences','Likely consequences')}{text('measures','Containment and remedial measures')}{text('contact','Response contact / responsible office')}{text('rationale','Assessment rationale and exception basis','Explain notification decisions and any applicable exceptions. An unknown assessment remains open.')}
        {current && <p>Saving creates version {current.version+1}. Earlier assessment and notice evidence remain available; record current-version notification evidence or supporting follow-up references.</p>}
        <div className="mc-breach-actions"><button type="submit" className="mc-breach-primary" disabled={busy}>{busy ? 'Saving…' : current ? 'Save assessment version':'Record breach'}</button><button type="button" onClick={onCancel} disabled={busy}>Cancel</button></div>
    </form>;
}

function NotificationForm({ current,onSaved }) {
    const [form,setForm]=useState({audience:`${current.obligations[0].regime}:${current.obligations[0].audience}`,status:'sent',channel:'portal',occurredAt:new Date().toISOString().slice(0,16),evidence:'',delayReason:''});
    const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const prefix=useId();
    const update=event=>setForm({...form,[event.target.name]:event.target.value});
    const submit=async event=>{event.preventDefault();setError('');setBusy(true);try {
        const [regime,audience]=form.audience.split(':');
        await onSaved(await breachApi.record(current.id,{...form,regime,audience,expectedVersion:current.version,occurredAt:new Date(`${form.occurredAt}Z`).toISOString()}));
        setForm(previous=>({...previous,evidence:'',delayReason:''}));
    } catch(err) {setError(message(err));} finally {setBusy(false);} };
    return <form className="mc-breach-form" onSubmit={submit} aria-label="Record notification evidence"><h3>Notification evidence</h3><p>This records a notice or attempt made outside Medicare. It does not send a message or submit a regulator report.</p>
        {error && <p role="alert" className="mc-breach-error">{error}</p>}
        <label htmlFor={`${prefix}-audience`}>Audience<select id={`${prefix}-audience`} name="audience" value={form.audience} onChange={update}>{current.obligations.map(o=><option key={`${o.regime}:${o.audience}`} value={`${o.regime}:${o.audience}`}>{o.regime.toUpperCase()} · {label(o.audience)}</option>)}</select></label>
        <div className="mc-breach-fields"><label htmlFor={`${prefix}-status`}>Outcome<select id={`${prefix}-status`} name="status" value={form.status} onChange={update}><option value="sent">Sent / submitted</option><option value="failed">Failed attempt</option></select></label><label htmlFor={`${prefix}-channel`}>Channel<select id={`${prefix}-channel`} name="channel" value={form.channel} onChange={update}>{['portal','post','email','telephone','in_person','other'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label></div>
        <label htmlFor={`${prefix}-time`}>Notice / attempt time (UTC)<input id={`${prefix}-time`} type="datetime-local" name="occurredAt" value={form.occurredAt} onChange={update} required /></label>
        <label htmlFor={`${prefix}-reference`}>Evidence / submission reference<textarea id={`${prefix}-reference`} name="evidence" value={form.evidence} onChange={update} minLength="10" maxLength="4000" required rows="3" /><small>Use a delivery receipt, submission identifier or failure reference. Avoid recipient identifiers and medical content.</small></label>
        <label htmlFor={`${prefix}-delay`}>Reason for delay, if applicable<textarea id={`${prefix}-delay`} name="delayReason" value={form.delayReason} onChange={update} maxLength="4000" rows="2" /><small>Required when the attempt occurred after the reminder deadline. A failed attempt does not satisfy a required notice.</small></label>
        <button type="submit" className="mc-breach-primary" disabled={busy}>{busy?'Recording…':'Record evidence'}</button>
    </form>;
}

export default function BreachWorkspace() {
    const [cases,setCases]=useState([]); const [current,setCurrent]=useState(null); const [error,setError]=useState('');
    const [loading,setLoading]=useState(true); const [editing,setEditing]=useState(false); const [creating,setCreating]=useState(false);
    const [page,setPage]=useState(1); const [hasMore,setHasMore]=useState(false); const [busy,setBusy]=useState(false);
    useEffect(()=>{let active=true;setLoading(true);setError('');breachApi.list(page).then(result=>{if(active){setCases(result.cases);setHasMore(result.hasMore);}}).catch(err=>{if(active)setError(message(err));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[page]);
    const open=async id=>{setBusy(true);setError('');try{setCurrent(await breachApi.get(id));setCreating(false);setEditing(false);}catch(err){setError(message(err));}finally{setBusy(false);}};
    const saved=async value=>{
        setCurrent(value);setCreating(false);setEditing(false);
        try { const [detail,result]=await Promise.all([breachApi.get(value.id),breachApi.list(page)]);setCurrent(detail);setCases(result.cases);setHasMore(result.hasMore); }
        catch { setError('Saved successfully, but the case list could not refresh. Reload before making another change.'); }
    };
    const status=async value=>{setBusy(true);setError('');try{await breachApi.status(current.id,value);await saved(current);}catch(err){setError(message(err));}finally{setBusy(false);}};
    return <section className="mc-breach" aria-label="Breach response workspace">
        <div className="mc-breach-heading"><div><h3>Breach response</h3><p>Keep assessment decisions, notification evidence, and follow-up together.</p></div><button type="button" className="mc-breach-primary" disabled={busy} onClick={()=>{setCreating(true);setEditing(false);setError('');}}>Record potential breach</button></div>
        {error && <p role="alert" className="mc-breach-error">{error}</p>}
        <div className="mc-breach-layout"><aside aria-label="Breach cases"><h4>Recorded cases</h4>{loading?<p role="status">Loading cases…</p>:!cases.length&&!error?<p>No breach assessments recorded.</p>:<ul>{cases.map(item=><li key={item.id}><button type="button" onClick={()=>open(item.id)} disabled={busy} aria-pressed={current?.id===item.id}><strong>{date(item.assessment.discoveredAt)}</strong><span>{item.status} · {item.assessment.regimes.join(' / ').toUpperCase()}</span><span>{item.obligations.filter(o=>o.status.endsWith('overdue')).length} overdue reminders</span></button></li>)}</ul>}
            <div className="mc-breach-actions"><button type="button" disabled={page===1||loading} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button type="button" disabled={!hasMore||loading} onClick={()=>setPage(page+1)}>Next</button></div></aside>
            <div className="mc-breach-detail">{creating?<AssessmentForm key="new" onSaved={saved} onCancel={()=>setCreating(false)} />:current?editing?<AssessmentForm key={current.version} current={current} onSaved={saved} onCancel={()=>setEditing(false)} />:<>
                <div className="mc-breach-heading"><div><h3>Assessment version {current.version}</h3><p>{current.status} · Awareness {date(current.assessment.discoveredAt)}</p></div><div className="mc-breach-actions"><button type="button" onClick={()=>setEditing(true)} disabled={current.status==='Resolved'}>Reassess</button><button type="button" onClick={()=>status(current.status==='Resolved'?'Investigating':'Resolved')} disabled={busy}>{current.status==='Resolved'?'Reopen':'Resolve incident'}</button></div></div>
                <p className="mc-breach-callout">Act without undue or unreasonable delay. Time limits shown are review reminders, not permission to wait. Resolve only after the assessment is complete and required evidence is recorded.</p>
                <ul className="mc-breach-obligations">{current.obligations.map(o=><li key={`${o.regime}:${o.audience}`}><strong>{o.regime.toUpperCase()} · {label(o.audience)}</strong><span className={o.status.endsWith('overdue')?'mc-breach-error':''}>{label(o.status)}</span><p>{date(o.dueAt)}</p><small>{o.explanation}</small></li>)}</ul>
                <details><summary>Assessment facts and rationale</summary>{['facts','consequences','measures','contact','rationale','hipaaFactors'].filter(key=>current.assessment[key]).map(key=><section key={key}><h4>{label(key)}</h4><p className="mc-breach-preserve">{current.assessment[key]}</p></section>)}</details>
                {current.status!=='Resolved'&&<NotificationForm key={`${current.id}:${current.version}`} current={current} onSaved={saved} />}
                <h3>Notice history</h3>{current.notifications.length?<ol className="mc-breach-history">{current.notifications.map(n=><li key={n.id}><strong>{n.regime.toUpperCase()} · {label(n.audience)} · {n.status}</strong><p>{date(n.occurred_at)} · {label(n.channel)} · assessment {n.assessment_version}</p><p className="mc-breach-preserve">{n.evidence.reference}</p>{n.evidence.delayReason&&<p>Delay: {n.evidence.delayReason}</p>}</li>)}</ol>:<p>No notification evidence recorded.</p>}
                <details><summary>Assessment version history ({current.history?.length||0})</summary>{current.history?.map(h=><div key={h.version}><h4>Version {h.version} · {date(h.recorded_at)}</h4><p>{h.assessment.rationale}</p></div>)}</details>
            </>:<p>Select a case to review it, or record a potential breach.</p>}</div></div>
    </section>;
}
