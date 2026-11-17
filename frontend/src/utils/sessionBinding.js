import { getAuthHeader } from './tokenManager';
export const SESSION_EVENT_KEY = 'medicare_session_event_v1';
export const SESSION_SOURCE = crypto.randomUUID();
let revision = 0;
let boundVerifier = null;
let transition = Promise.resolve();
export const snapshotSession = () => ({ revision, verifier: getAuthHeader()['X-CSRF-Token'] || '' });
export const isCurrentSession = snapshot => !snapshot || (snapshot.revision === revision && snapshot.verifier === (getAuthHeader()['X-CSRF-Token'] || ''));
export function sessionChangedError() {
    window.dispatchEvent(new Event('medicare:session-changed'));
    return Object.assign(new Error('Your session changed. Reopen this form after verification.'), { code:'ERR_SESSION_CHANGED' });
}
export function assertBoundSession() {
    if (boundVerifier !== null && boundVerifier !== (getAuthHeader()['X-CSRF-Token'] || '')) throw sessionChangedError();
}
export const hasSessionChanged = () => boundVerifier !== null && boundVerifier !== (getAuthHeader()['X-CSRF-Token'] || '');
export function bindSession() { revision++; boundVerifier=getAuthHeader()['X-CSRF-Token'] || ''; }
export function unbindSession() { revision++; boundVerifier=''; }
export function publishSessionChange() {
    const event={source:SESSION_SOURCE,nonce:crypto.randomUUID()};
    try { localStorage.setItem(SESSION_EVENT_KEY,JSON.stringify(event)); } catch { /* BroadcastChannel covers storage quota failures. */ }
    if(typeof BroadcastChannel==='function') { const channel=new BroadcastChannel(SESSION_EVENT_KEY);channel.postMessage(event);channel.close(); }
}
export function serializeSessionTransition(operation) {
    const pending=transition.then(operation,operation);
    transition=pending.catch(()=>{});
    return pending;
}
