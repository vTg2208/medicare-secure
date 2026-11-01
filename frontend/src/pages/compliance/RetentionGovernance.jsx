import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import apiClient from '../../api/client';
import ThemeToggle from '../../components/common/ThemeToggle';
import '../privacy/PrivacyCenter.css';

export default function RetentionGovernance(){
    const [data,setData]=useState({policies:[],holds:[],approvals:[]});
    const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
    const [policy,setPolicy]=useState({organizationId:'',recordType:'note',retentionDays:'',jurisdiction:'',basis:''});
    const [hold,setHold]=useState({patientId:'',basis:''});
    const [recordId,setRecordId]=useState('');const [eligibility,setEligibility]=useState(null);const [basis,setBasis]=useState('');
    const [resourceType,setResourceType]=useState('medical_record');
    const version=useRef(0);
    const load=useCallback(async()=>{
        setError('');
        try{const [policies,holds,approvals]=await Promise.all(['policies','holds','approvals'].map(path=>apiClient.get(`/retention/${path}`)));setData({policies:policies.data.data,holds:holds.data.data,approvals:approvals.data.data});}
        catch{setError('Unable to load retention governance. Please retry.');}
    },[]);
    useEffect(()=>{load();},[load]);
    const mutate=async(path,body,success)=>{
        setBusy(true);setError('');setNotice('');
        try{await apiClient.post(path,body);setNotice(success);await load();return true;}
        catch(failure){setError(failure.response?.data?.message||'The decision was not saved. Please retry.');return false;}
        finally{setBusy(false);}
    };
    const publish=async event=>{event.preventDefault();if(await mutate('/retention/policies',{...policy,organizationId:policy.organizationId||null,retentionDays:Number(policy.retentionDays)},'Retention policy published. Previous policy evidence is retained.'))setPolicy(current=>({...current,basis:''}));};
    const placeHold=async event=>{event.preventDefault();if(await mutate('/retention/holds',hold,'Legal hold placed. Disposal will remain blocked until an officer releases it.'))setHold({patientId:'',basis:''});};
    const check=async event=>{
        event.preventDefault();const revision=++version.current;setBusy(true);setError('');setEligibility(null);
        try{const result=await apiClient.get('/retention/eligibility',{params:{recordId,resourceType}});if(revision===version.current)setEligibility(result.data.data);}
        catch(failure){if(revision===version.current)setError(failure.response?.data?.message||'Unable to check disposal eligibility.');}
        finally{if(revision===version.current)setBusy(false);}
    };
    const approve=async event=>{event.preventDefault();if(await mutate('/retention/approvals',{recordId:eligibility.recordId,resourceType,basis},'Disposal approved for operator review. No data was deleted.')){setEligibility(null);setBasis('');}};
    return <div className="privacy-center mc-workspace"><header className="privacy-topbar"><Link to="/compliance/dashboard">Compliance dashboard</Link><ThemeToggle/></header><main className="privacy-content">
        <header className="privacy-page-heading"><h1>Retention governance</h1><p>Publish reviewed retention periods, preserve legal holds and approve eligible disposal. Approval does not delete data.</p></header>
        {error&&<div role="alert">{error} <button onClick={load}>Retry</button></div>}{notice&&<p role="status">{notice}</p>}
        <div className="privacy-actions-grid"><section className="privacy-panel"><h2>Retention policies</h2><form onSubmit={publish}>
            <label htmlFor="retention-clinic">Clinic ID (leave blank for standalone records)</label><input id="retention-clinic" value={policy.organizationId} onChange={event=>setPolicy({...policy,organizationId:event.target.value})}/>
            <label htmlFor="retention-category">Record category</label><select id="retention-category" value={policy.recordType} onChange={event=>setPolicy({...policy,recordType:event.target.value})}>{['consultation','diagnosis','treatment','prescription','lab_result','imaging','procedure','vaccination','note','other','care_message','triage_session'].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select>
            <label htmlFor="retention-days">Retention period in days</label><input id="retention-days" type="number" min="1" max="365000" value={policy.retentionDays} onChange={event=>setPolicy({...policy,retentionDays:event.target.value})} required/>
            <label htmlFor="retention-jurisdiction">Applicable jurisdiction</label><input id="retention-jurisdiction" value={policy.jurisdiction} onChange={event=>setPolicy({...policy,jurisdiction:event.target.value})} required minLength={2} maxLength={100}/>
            <label htmlFor="retention-policy-basis">Reviewed policy basis</label><textarea id="retention-policy-basis" value={policy.basis} onChange={event=>setPolicy({...policy,basis:event.target.value})} required minLength={10} maxLength={4000}/>
            <button className="privacy-button" disabled={busy}>Publish retention policy</button>
        </form><ul>{data.policies.map(item=><li key={item.id}>{item.record_type} · {item.retention_days} days · {item.jurisdiction} · {item.active?'active':'superseded'}</li>)}</ul></section>
        <section className="privacy-panel"><h2>Legal holds</h2><form onSubmit={placeHold}><label htmlFor="hold-patient">Patient ID for legal hold</label><input id="hold-patient" value={hold.patientId} onChange={event=>setHold({...hold,patientId:event.target.value})} required/>
            <label htmlFor="hold-basis">Legal hold basis</label><textarea id="hold-basis" value={hold.basis} onChange={event=>setHold({...hold,basis:event.target.value})} required minLength={10} maxLength={4000}/><button className="privacy-button" disabled={busy}>Place legal hold</button></form>
            <ul>{data.holds.map(item=><li key={item.id}><p>Patient {item.patient_id}</p><p>{item.basis}</p><button disabled={busy} onClick={()=>mutate(`/retention/holds/${item.id}/release`,{},'Legal hold released with retained officer evidence.')}>Release hold</button></li>)}</ul>
        </section></div>
        <section className="privacy-panel"><h2>Disposal review</h2><form onSubmit={check}><label htmlFor="disposal-resource">Information category</label><select id="disposal-resource" value={resourceType} onChange={event=>{version.current++;setBusy(false);setResourceType(event.target.value);setEligibility(null);}}><option value="medical_record">Medical record</option><option value="care_message">Care correspondence</option><option value="triage_session">AI intake</option></select><label htmlFor="disposal-record">Medical record ID</label><input id="disposal-record" value={recordId} onChange={event=>{version.current++;setBusy(false);setRecordId(event.target.value);setEligibility(null);}} required/><button className="privacy-button" disabled={busy}>Check disposal eligibility</button></form>
            {eligibility&&<div><p>{eligibility.eligible?'Eligible for a reviewed disposal decision.':'Disposal blocked.'}</p><ul>{eligibility.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
                {eligibility.eligibleAfter&&<p>Retention expires: {new Date(eligibility.eligibleAfter).toLocaleString()}</p>}
                {eligibility.eligible&&<form onSubmit={approve}><label htmlFor="disposal-basis">Disposal approval basis</label><textarea id="disposal-basis" value={basis} onChange={event=>setBasis(event.target.value)} required minLength={10} maxLength={4000}/><button className="privacy-button" disabled={busy}>Approve disposal</button></form>}
            </div>}
            <p className="privacy-hint">An authorized operator must recheck the policy, legal holds and active care before execution. Attachments remain pending until their cleanup completes.</p>
            <ul>{data.approvals.map(item=><li key={item.id}>Decision {item.id} · Record {item.record_id} · {item.status.replaceAll('_',' ')}</li>)}</ul>
        </section>
    </main></div>;
}
