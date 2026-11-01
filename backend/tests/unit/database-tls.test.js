const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {databaseTls}=require('../../src/config/database-tls');
it('verifies certificates with a minimum TLS version and supports public CA files',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'db-ca-'));
    try {const file=path.join(root,'ca.crt');fs.writeFileSync(file,'Synthetic public CA');
        expect(databaseTls({DB_SSL:'true',DB_SSL_CA_FILE:file})).toEqual({rejectUnauthorized:true,minVersion:'TLSv1.2',ca:'Synthetic public CA'});
    }finally{fs.rmSync(root,{recursive:true});}
});
it('fails closed for a missing configured CA file',()=>{
    expect(()=>databaseTls({DB_SSL:'true',DB_SSL_CA_FILE:'/missing/fixture-ca.crt'})).toThrow();
});
it('preserves escaped inline public CA and isolated plaintext test mode',()=>{
    expect(databaseTls({DB_SSL:'true',DB_SSL_CA:'line1\\nline2'}).ca).toBe('line1\nline2');
    expect(databaseTls({DB_SSL:'false'})).toBe(false);
});
