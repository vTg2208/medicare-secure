const {sanitizeMessage,sanitizeMetadata,sanitizeLogRecord}=require('../../src/utils/log-sanitizer');

it('preserves constant diagnostics and allowlisted operational values',()=>{
    expect(sanitizeMessage('Database operation failed')).toBe('Database operation failed');
    expect(sanitizeMetadata({requestId:'11111111-1111-1111-1111-111111111111',count:3,code:'23505',email:'private@example.invalid',phone:'919876543210',userId:'patient-id'}))
        .toEqual({requestId:'11111111-1111-1111-1111-111111111111',count:3,code:'23505'});
});
it('removes personal identifiers, bearer credentials and invitation paths from strings',()=>{
    const clean=sanitizeMessage('Delivery private@example.invalid phone 919876543210 /api/staff/invitations/private-token/accept Bearer private-bearer');
    for(const value of ['private@example.invalid','919876543210','private-token','private-bearer']) expect(clean).not.toContain(value);
    expect(clean).toContain('Delivery');
});
it('does not copy nested clinical payloads, raw SQL or error details',()=>{
    const error=Object.assign(new Error('private diagnosis'),{code:'23505',detail:'private row',sql:'INSERT private'});
    const clean=sanitizeLogRecord({level:'error',message:'private message',stack:'private stack',error,
        payload:{password:'private password'},context:{count:2,diagnosis:'private diagnosis'},[Symbol.for('message')]:'private serialized content'});
    expect(clean.message).toBe('Application error');
    expect(clean.errorCode).toBe('23505');
    expect(clean.context).toEqual({count:2});
    expect(JSON.stringify(clean)).not.toContain('private');
    expect(clean[Symbol.for('message')]).toBeUndefined();
});
it('bounds cyclic metadata and never invokes client-controlled getters',()=>{
    const value={count:1}; value.context=value;
    Object.defineProperty(value,'code',{get(){throw new Error('must not read');}});
    expect(()=>sanitizeMetadata(value)).not.toThrow();
    expect(JSON.stringify(sanitizeMetadata(value)).length).toBeLessThan(200);
});
it('retains fatal routing markers while removing process and stack contents',()=>{
    const clean=sanitizeLogRecord({level:'error',message:'private',exception:true,error:Object.assign(new Error('private'),{code:'ECONNRESET'}),process:{env:{secret:'private'}},trace:['private']});
    expect(clean.message).toBe('Unhandled application exception');
    expect(clean.exception).toBe(true); expect(clean.errorCode).toBe('ECONNRESET');
    expect(JSON.stringify(clean)).not.toContain('private');
});
