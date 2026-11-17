import apiClient,{handleUnauthorized} from '../api/client';
import * as binding from './sessionBinding';
import { getSignOutState,setSignOutState } from './tokenManager';
beforeEach(()=>{localStorage.clear();setSignOutState(null);document.cookie='medicare_csrf=account-a; Path=/';});
test('a tab cannot submit an old account form with a newly replaced session cookie',async()=>{
    expect(binding.bindSession).toBeTypeOf('function');binding.bindSession();
    document.cookie='medicare_csrf=account-b; Path=/';
    const adapter=vi.fn();
    await expect(apiClient.post('/records',{title:'Account A form'},{adapter})).rejects.toMatchObject({code:'ERR_SESSION_CHANGED'});
    expect(adapter).not.toHaveBeenCalled();
});
test('obsolete reads and 401 responses cannot restore data or sign out the newer session',async()=>{
    expect(binding.bindSession).toBeTypeOf('function');binding.bindSession();
    let complete,config;
    const pending=apiClient.get('/records',{adapter:received=>{config=received;return new Promise(resolve=>{complete=resolve;});}});
    const observed=pending.catch(error=>error);
    await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));
    document.cookie='medicare_csrf=account-b; Path=/';binding.bindSession();
    complete({status:200,data:{patient:'a'},headers:{},config});
    expect(await observed).toMatchObject({code:'ERR_SESSION_CHANGED'});
    const redirect=vi.fn();const error={response:{status:401},config};
    await expect(handleUnauthorized(error,redirect)).rejects.toBe(error);
    expect(redirect).not.toHaveBeenCalled();expect(getSignOutState()).toBeNull();
});
