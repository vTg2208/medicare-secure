const SIGN_OUT_KEY = 'medicare_sign_out_v1';
let memorySignOut = null;
const cookieSuffix = () => `; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
const markerName = () => window.location.protocol === 'https:' ? '__Host-medicare_sign_out' : 'medicare_sign_out';
const readMarkerCookie = () => {
    try { const part=document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${markerName()}=`)); return part ? decodeURIComponent(part.slice(markerName().length+1)) : null; }
    catch { return null; }
};
const persistable = () => {
    const probe = `probe-${Date.now()}`;
    try { localStorage.setItem('medicare_state_probe',probe); const ok=localStorage.getItem('medicare_state_probe')===probe; localStorage.removeItem('medicare_state_probe'); if(ok)return true; } catch { /* Try the cookie alternative. */ }
    try { document.cookie=`medicare_state_probe=${probe}${cookieSuffix()}`; const ok=document.cookie.split(';').some(value=>value.trim()===`medicare_state_probe=${probe}`); document.cookie=`medicare_state_probe=; Max-Age=0${cookieSuffix()}`; return ok; } catch { return false; }
};
const rawState = () => {
    let stored; try { stored=localStorage.getItem(SIGN_OUT_KEY); } catch { /* Cookie and memory still work. */ }
    return memorySignOut || readMarkerCookie() || stored;
};

export function clearLegacyCredentials() {
    for (const storage of ['localStorage', 'sessionStorage']) {
        try { window[storage].removeItem('healthcare_token'); } catch { /* Storage can be unavailable in a private context. */ }
    }
}
export function getSignOutState() {
    const raw=rawState();
    if (raw) {
        const [state,verifier]=raw.split('|');
        if (verifier && verifier !== getAuthHeader()['X-CSRF-Token']) return null;
        return state;
    }
    return persistable() ? null : 'unavailable';
}
export function getSignOutVerifier() { return rawState()?.split('|')[1] || ''; }
export function setSignOutState(value, verifier = getAuthHeader()['X-CSRF-Token'] || '') {
    const raw=value ? `${value}${verifier ? `|${verifier}` : ''}` : null;
    memorySignOut = raw;
    try {
        if (raw) localStorage.setItem(SIGN_OUT_KEY, raw);
        else localStorage.removeItem(SIGN_OUT_KEY);
    } catch { /* A reload with unavailable storage requires a new sign-in. */ }
    try { document.cookie=`${markerName()}=${raw ? encodeURIComponent(raw) : ''}; Max-Age=${raw ? 2592000 : 0}${cookieSuffix()}`; } catch { /* Bootstrap probes persistence and fails closed if both stores fail. */ }
}
export function getAuthHeader() {
    let cookies;
    try { cookies = document.cookie; } catch { return {}; }
    const name = window.location.protocol === 'https:' ? '__Host-medicare_csrf' : 'medicare_csrf';
    const matches = cookies.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
    if (matches.length !== 1) return {};
    const value = matches[0].slice(name.length + 1);
    return /^[A-Za-z0-9_-]{1,128}$/.test(value) ? { 'X-CSRF-Token': value } : {};
}
