const clearCookies=()=>document.cookie.split(';').forEach(part=>{document.cookie=`${part.trim().split('=')[0]}=; Max-Age=0; Path=/`;});
beforeEach(()=>{vi.resetModules();vi.restoreAllMocks();localStorage.clear();clearCookies();});
afterEach(()=>vi.restoreAllMocks());
test('a readable but unwritable localStorage cannot forget pending logout after reload',async()=>{
    const auth=await import('./tokenManager');
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('QuotaExceeded');});
    auth.setSignOutState('pending');
    expect(auth.getSignOutState()).toBe('pending');
    vi.resetModules();
    const reloaded=await import('./tokenManager');
    expect(reloaded.getSignOutState()).toBe('pending');
});
test('bootstrap fails closed when neither cookies nor web storage can persist logout intent',async()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('QuotaExceeded');});
    vi.spyOn(document,'cookie','get').mockReturnValue('medicare_csrf=old-session');
    vi.spyOn(document,'cookie','set').mockImplementation(()=>{});
    const auth=await import('./tokenManager');
    expect(auth.getSignOutState()).toBe('unavailable');
});
