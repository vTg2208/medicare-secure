const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {withApplication}=require('./helpers/application-fixture');
test('private runtime grants support conversation upserts and row locks without message rewrite privileges',{skip:process.env.RUN_DB_TESTS!=='true'},async()=>withApplication('message_runtime',async({db,people})=>{
    const role=`message_runtime_${process.pid}`;assert.match(role,/^message_runtime_\d+$/);const client=await db.pool.connect();
    try {
        await client.query(`CREATE ROLE ${role} NOLOGIN`);
        const schema=(await client.query('SELECT current_schema() AS name')).rows[0].name;assert.ok(['public','healthcare'].includes(schema));
        await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
        const sql=fs.readFileSync(path.resolve(__dirname,'../scripts/private-runtime-grants.sql'),'utf8').replaceAll('healthcare.',schema+'.').replaceAll('healthcare_api',role);
        await client.query(sql);await client.query(`SET ROLE ${role}`);
        const upsert=()=>client.query(`INSERT INTO care_message_threads(patient_id,provider_id) VALUES($1,$2) ON CONFLICT(patient_id,provider_id) DO UPDATE SET patient_id=EXCLUDED.patient_id RETURNING id`,[people.patient.id,people.doctor.id]);
        const first=(await upsert()).rows[0].id;assert.equal((await upsert()).rows[0].id,first);
        await client.query('BEGIN');try{assert.equal((await client.query('SELECT id FROM care_message_threads WHERE id=$1 FOR UPDATE',[first])).rows[0].id,first);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}
        await assert.rejects(client.query('UPDATE care_message_threads SET provider_id=provider_id WHERE id=$1',[first]),{code:'42501'});
        await assert.rejects(client.query("UPDATE care_messages SET body_cipher='forged' WHERE thread_id=$1",[first]),{code:'42501'});
        await assert.rejects(client.query('DELETE FROM care_messages WHERE thread_id=$1',[first]),{code:'42501'});
    }finally{await client.query('RESET ROLE');await client.query(`DROP OWNED BY ${role}`);await client.query(`DROP ROLE ${role}`);client.release();}
}));
