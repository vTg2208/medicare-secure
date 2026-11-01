// Opt-in against an isolated TLS fixture only; never production credentials.
const {test}=require('node:test');const assert=require('node:assert/strict');
const {Client}=require('pg');const {databaseTls}=require('../src/config/database-tls');
test('database transport verifies identity and rejects plaintext',{skip:process.env.RUN_TLS_TESTS!=='true'},async t=>{
    assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DB_HOST,'127.0.0.1');
    const config={host:'127.0.0.1',port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,connectionTimeoutMillis:4000};
    await t.test('trusted server uses encrypted TLS 1.2 or newer',async()=>{
        const client=new Client({...config,ssl:databaseTls({DB_SSL:'true',DB_SSL_CA_FILE:process.env.TLS_FIXTURE_CA_FILE})});
        try {await client.connect();const row=(await client.query('SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0];assert.equal(row.ssl,true);assert.match(row.version,/^TLSv1\.[23]$/);}finally{await client.end();}
    });
    for(const [name,ssl] of [['untrusted CA',{rejectUnauthorized:true}],['wrong hostname',{...databaseTls({DB_SSL:'true',DB_SSL_CA_FILE:process.env.TLS_FIXTURE_CA_FILE}),servername:'wrong.fixture.invalid'}],['plaintext',false]]) {
        await t.test(`rejects ${name}`,async()=>{const client=new Client({...config,ssl});try{await assert.rejects(client.connect());}finally{await client.end();}});
    }
});
