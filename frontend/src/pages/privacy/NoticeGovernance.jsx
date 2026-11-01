import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {noticeApi} from '../../api/noticeApi';
import Brand from '../../components/common/Brand';
import ThemeToggle from '../../components/common/ThemeToggle';
import NoticeContent,{NOTICE_SECTIONS,noticeDate} from './NoticeContent';
import './PrivacyCenter.css';
import './PrivacyNotice.css';
const emptyForm=()=>({title:'',operatorName:'',contactEmail:'',sections:Object.fromEntries(Object.keys(NOTICE_SECTIONS).map(key=>[key,''])),reviewBasis:''});
const fromNotice=notice=>({...emptyForm(),...(notice?.content||{}),sections:{...emptyForm().sections,...notice?.content.sections},reviewBasis:''});
export default function NoticeGovernance(){
    const {user}=useAuth();const role=user?.role,userId=user?.id;
    const [form,setForm]=useState(emptyForm),[preview,setPreview]=useState(false),[confirmed,setConfirmed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
    const [error,setError]=useState(''),[historyError,setHistoryError]=useState(''),[published,setPublished]=useState(null),[history,setHistory]=useState({versions:[],hasMore:false,nextBefore:null}),[moreBusy,setMoreBusy]=useState(false);
    useEffect(()=>{
        let active=true;if(role!=='compliance_officer')return()=>{active=false;};
        setLoading(true);setForm(emptyForm());setPreview(false);setConfirmed(false);setError('');setHistoryError('');setPublished(null);
        Promise.allSettled([noticeApi.current(),noticeApi.publications()]).then(([current,versions])=>{
            if(!active)return;
            if(current.status==='fulfilled')setForm(fromNotice(current.value));else setError('The current notice could not be loaded. Review the published notice before creating a revision.');
            if(versions.status==='fulfilled')setHistory(versions.value);else setHistoryError('Publication history could not be loaded.');
            setLoading(false);
        });return()=>{active=false;};
    },[role,userId]);
    const update=(key,value)=>setForm(previous=>({...previous,[key]:value}));
    const publish=async()=>{
        if(!confirmed||busy)return;setBusy(true);setError('');
        let version;
        try{version=await noticeApi.publish(form);}
        catch(failure){setError(failure.response?.data?.message||'Unable to publish this notice. Please retry.');setBusy(false);return;}
        setPublished(version);setForm(fromNotice(version));setPreview(false);setConfirmed(false);setBusy(false);
        // Publication is committed. A separate history failure must not invite duplicate publication.
        try{setHistory(await noticeApi.publications());setHistoryError('');}
        catch{setHistoryError('The notice was published, but publication history could not be refreshed.');}
    };
    const more=async()=>{
        if(!history.nextBefore||moreBusy)return;setMoreBusy(true);
        try{const next=await noticeApi.publications(history.nextBefore);setHistory(previous=>({...next,versions:[...previous.versions,...next.versions.filter(version=>!previous.versions.some(value=>value.id===version.id))]}));setHistoryError('');}
        catch{setHistoryError('Earlier publication history could not be loaded. Please retry.');}finally{setMoreBusy(false);}
    };
    if(role!=='compliance_officer')return <main className="privacy-center privacy-content"><h1>Publication access denied</h1><p>A compliance officer must review and publish notices.</p></main>;
    return <div className="privacy-center mc-workspace"><header className="privacy-topbar"><Brand to="/compliance/dashboard"/><nav aria-label="Publication navigation"><Link to="/compliance/privacy">Privacy requests</Link><Link to="/privacy-notice">Read current notice</Link></nav><ThemeToggle/></header>
        <main className="privacy-content notice-content"><header className="privacy-page-heading"><span className="privacy-eyebrow">Reviewed public information</span><h1>Publish privacy notice</h1><p>Each publication preserves the earlier notice and patient receipts. Review actual operator facts before publishing.</p></header>
            {published&&<div className="privacy-notice" role="status">Notice version {published.versionNumber} published. <Link to={`/privacy-notice/${published.id}`}>Read published version</Link></div>}
            {error&&<p role="alert" className="privacy-error">{error}</p>}
            {loading?<p role="status">Loading publication information…</p>:preview?<section className="notice-preview"><NoticeContent notice={{content:form}} preview/><div className="privacy-panel notice-confirmation"><p>Reading this notice will not grant consent or establish that external safeguards have been verified.</p><label className="notice-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>setConfirmed(event.target.checked)}/>I have reviewed this information and am authorized to publish it.</label><div className="notice-buttons"><button className="privacy-button" disabled={!confirmed||busy} onClick={publish}>{busy?'Publishing…':'Publish notice'}</button><button className="privacy-text-button" disabled={busy} onClick={()=>{setPreview(false);setConfirmed(false);}}>Edit notice</button></div></div></section>:<section className="privacy-panel"><h2>Notice content</h2><form onSubmit={event=>{event.preventDefault();setPreview(true);setConfirmed(false);setError('');}}>
                <label htmlFor="notice-title">Notice title</label><input id="notice-title" value={form.title} onChange={event=>update('title',event.target.value)} required minLength={3} maxLength={200}/>
                <label htmlFor="notice-operator">Responsible operator</label><input id="notice-operator" value={form.operatorName} onChange={event=>update('operatorName',event.target.value)} required minLength={3} maxLength={200}/>
                <label htmlFor="notice-contact">Privacy contact email</label><input id="notice-contact" type="email" value={form.contactEmail} onChange={event=>update('contactEmail',event.target.value)} required maxLength={254}/>
                {Object.entries(NOTICE_SECTIONS).map(([key,label])=><React.Fragment key={key}><label htmlFor={`notice-${key}`}>{label}</label><textarea id={`notice-${key}`} value={form.sections[key]} onChange={event=>setForm(previous=>({...previous,sections:{...previous.sections,[key]:event.target.value}}))} required minLength={20} maxLength={6000} rows={4}/></React.Fragment>)}
                <p className="privacy-hint">Explain sections that are not applicable. Describe actual recipients, retention and security limits; avoid unsupported assurances.</p>
                <label htmlFor="notice-review">Private publication review basis</label><textarea id="notice-review" value={form.reviewBasis} onChange={event=>update('reviewBasis',event.target.value)} required minLength={10} maxLength={4000} rows={3}/><p className="privacy-hint">Kept with officer review evidence, outside the public notice. Do not enter patient information.</p>
                <button className="privacy-button">Preview notice</button>
            </form></section>}
            <section className="privacy-panel notice-publications"><h2>Publication history</h2>{historyError&&<p role="alert" className="privacy-error">{historyError}</p>}
                {!history.versions.length&&!historyError&&!loading&&<p>No notices have been published.</p>}
                <ul className="notice-history">{history.versions.map(version=><li key={version.id}><Link to={`/privacy-notice/${version.id}`}>Notice version {version.versionNumber}: {version.content.title}</Link><time dateTime={version.publishedAt}>{noticeDate(version.publishedAt)}</time><details><summary>Officer review basis</summary><p className="notice-section-text">{version.reviewBasis}</p></details></li>)}</ul>
                {history.hasMore&&<button className="privacy-button" disabled={moreBusy||busy} onClick={more}>{moreBusy?'Loading earlier versions…':'Load earlier versions'}</button>}
            </section>
        </main></div>;
}
