import React,{useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {noticeApi} from '../../api/noticeApi';
import Brand from '../../components/common/Brand';
import ThemeToggle from '../../components/common/ThemeToggle';
import NoticeContent,{noticeDate} from './NoticeContent';
import './PrivacyCenter.css';
import './PrivacyNotice.css';

export default function PrivacyNotice() {
    const {versionId}=useParams();const {user}=useAuth();const patient=user?.role==='patient';const userId=user?.id;
    const [notice,setNotice]=useState(null),[history,setHistory]=useState(null),[currentId,setCurrentId]=useState(null);
    const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[historyError,setHistoryError]=useState('');
    const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[ackError,setAckError]=useState(''),[stale,setStale]=useState(false),[message,setMessage]=useState('');
    const [reload,setReload]=useState(0);const generation=useRef(0);
    useEffect(()=>{
        const token=++generation.current;let active=true;
        setLoading(true);setChecked(false);setBusy(false);setHistory(null);setNotice(null);setLoadError('');setHistoryError('');setAckError('');setMessage('');setStale(false);
        Promise.allSettled([
            versionId?noticeApi.version(versionId):noticeApi.current(),
            patient?noticeApi.acknowledgements():Promise.resolve(null),
            versionId?noticeApi.current():Promise.resolve(null),
        ]).then(([selected,owned,current])=>{
            if(!active||token!==generation.current)return;
            const selectedNotice=selected.status==='fulfilled'?selected.value:null;
            if(selected.status==='rejected')setLoadError('Unable to load this privacy notice. Please retry.');
            setNotice(selectedNotice);
            const ownedHistory=owned.status==='fulfilled'?owned.value:null;setHistory(ownedHistory);
            if(patient&&owned.status==='rejected')setHistoryError('Your acknowledgement history could not be loaded. Please retry.');
            if(current.status==='rejected')setLoadError('The current notice status could not be loaded. Please retry.');
            setCurrentId(ownedHistory?.currentVersionId||(current.status==='fulfilled'?current.value?.id:null)||(!versionId?selectedNotice?.id:null));
            setLoading(false);
        });
        return()=>{active=false;};
    },[versionId,patient,userId,reload]);
    const recorded=history?.receipts.find(receipt=>receipt.versionId===notice?.id);
    const isCurrent=Boolean(notice?.id&&notice.id===currentId);
    const acknowledge=async event=>{
        event.preventDefault();if(!checked||busy||!isCurrent||!history)return;
        const token=generation.current;setBusy(true);setAckError('');
        try {
            const receipt=await noticeApi.acknowledge(notice.id);
            if(token!==generation.current)return;
            setHistory(previous=>({...previous,acknowledgedCurrent:true,receipts:[...previous.receipts.filter(value=>value.id!==receipt.id),receipt]}));
            setMessage('Acknowledgement recorded. Your receipt appears below.');setChecked(false);
        }catch(error){
            if(token!==generation.current)return;
            if(error.response?.status===409){setStale(true);setChecked(false);setAckError('The notice has changed. Reload the current notice and read it before acknowledging.');}
            else setAckError(error.response?.data?.message||'Your acknowledgement could not be recorded. Please retry.');
        }finally{if(token===generation.current)setBusy(false);}
    };
    return <div className="privacy-center mc-workspace"><header className="privacy-topbar"><Brand to="/"/><nav aria-label="Notice navigation"><Link to="/privacy-notice">Privacy notice</Link>{patient?<Link to="/patient/privacy">Privacy center</Link>:<Link to="/login">Sign in</Link>}</nav><ThemeToggle/></header>
        <main className="privacy-content notice-content"><header className="privacy-page-heading"><span className="privacy-eyebrow">Information &amp; transparency</span><h1>Privacy notice</h1><p>Read how the responsible operator describes the handling of your information.</p></header>
            {loading?<p role="status">Loading privacy notice…</p>:<>
                {loadError&&<p role="alert" className="privacy-error">{loadError}</p>}
                {!notice&&!loadError&&<p className="privacy-empty">No privacy notice has been published. The responsible operator must publish reviewed information.</p>}
                {notice&&<>
                    {!isCurrent&&<div className="privacy-policy-note"><p>This is an earlier notice version. <Link to="/privacy-notice">Read current notice</Link></p>{!versionId&&<button className="privacy-button" onClick={()=>setReload(value=>value+1)}>Reload current notice</button>}</div>}
                    <NoticeContent notice={notice}/>
                    {patient&&<section className="privacy-panel notice-receipts"><h2>Notice acknowledgement</h2><p>This records that you read the notice. It does not give anyone permission to access your medical information.</p>
                        {historyError&&<p role="alert" className="privacy-error">{historyError}</p>}
                        {recorded&&<p>You acknowledged this version on <time dateTime={recorded.acknowledgedAt}>{noticeDate(recorded.acknowledgedAt)}</time>.</p>}
                        {message&&<p role="status" className="privacy-notice">{message}</p>}
                        {isCurrent&&!recorded&&history&&<form onSubmit={acknowledge}><label className="notice-checkbox"><input type="checkbox" checked={checked} disabled={busy||stale} onChange={event=>setChecked(event.target.checked)}/>I have read this version of the privacy notice.</label><button className="privacy-button" disabled={!checked||busy||stale}>{busy?'Recording…':'Record acknowledgement'}</button></form>}
                        {ackError&&<p role="alert" className="privacy-error">{ackError}</p>}
                        {stale&&<button className="privacy-button" onClick={()=>setReload(value=>value+1)}>Reload current notice</button>}
                        <h3>Your acknowledgement history</h3>{history?.receipts.length?<ul className="notice-history">{history.receipts.map(receipt=><li key={receipt.id}><Link to={`/privacy-notice/${receipt.versionId}`}>Read acknowledged notice version {receipt.notice.versionNumber}</Link><time dateTime={receipt.acknowledgedAt}>{noticeDate(receipt.acknowledgedAt)}</time></li>)}</ul>:!historyError&&<p className="privacy-hint">No notice acknowledgements recorded.</p>}
                    </section>}
                </>}
                {(loadError||historyError)&&<button className="privacy-button" onClick={()=>setReload(value=>value+1)}>Retry notice loading</button>}
            </>}
        </main></div>;
}
