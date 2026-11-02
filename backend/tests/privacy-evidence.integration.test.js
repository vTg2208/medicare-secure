const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {withApplication}=require('./helpers/application-fixture');

test('privacy fulfillment binds exact exports and explicit confirmations to their patient and case', {skip:process.env.RUN_DB_TESTS!=='true',timeout:90000},async t=>{
    await withApplication('fulfillmentevidence',async({db,people,call})=>{
        const password='Synthetic-evidence-password-42!';
        const hash=await require('../src/services/encryption.service').hashPassword(password);
        await db.query('UPDATE users SET password_hash=$1 WHERE id=ANY($2::uuid[])',[hash,[people.patient.id,people.otherPatient.id]]);
        await db.query("UPDATE users SET first_name='Zoë 医療' WHERE id=$1",[people.patient.id]);
        const create=async(type='access',actor='patient')=>(await call(actor,'POST','/privacy/requests',{type,details:'Please provide the supported information for my own account.'},201)).data;
        const review=async id=>call('officer','PUT',`/privacy/requests/${id}`,{status:'in_review'});
        const own=await create(); await review(own.id);
        const other=await create('portability','otherPatient'); await review(other.id);
        let exported;
        await t.test('request-scoped export persists exact non-ASCII download provenance without confirming receipt',async()=>{
            exported=await call('patient','POST',`/privacy/requests/${own.id}/export`,{currentPassword:password});
            const bytes=Buffer.from(JSON.stringify(exported.data,null,2));
            assert.equal(exported.receipt.contentHash,createHash('sha256').update(bytes).digest('hex'));
            assert.equal(exported.receipt.byteLength,bytes.length);
            assert.equal(exported.receipt.requestId,own.id); assert.equal(exported.receipt.patientId,people.patient.id);
            assert.equal(exported.receipt.confirmedAt,null); assert.equal(exported.data.patientId,people.patient.id);
            assert.ok(!JSON.stringify(exported).includes(password)); assert.ok(!JSON.stringify(exported).includes(hash));
            const list=(await call('patient','GET','/privacy/requests')).data;
            assert.equal(list[0].evidence.exports.length,1); assert.equal(list[0].evidence.exports[0].id,exported.receipt.id);
            assert.equal(list[0].status,'in_review');
        });
        if(!exported?.receipt)return;
        await t.test('export denies wrong roles, other owners, malformed bodies and wrong passwords',async()=>{
            await call('doctor','POST',`/privacy/requests/${own.id}/export`,{currentPassword:password},403);
            await call('otherPatient','POST',`/privacy/requests/${own.id}/export`,{currentPassword:password},404);
            await call('patient','POST',`/privacy/requests/${own.id}/export`,{currentPassword:password,patientId:people.otherPatient.id},400);
            await call('patient','POST',`/privacy/requests/${own.id}/export`,{currentPassword:'incorrect'},403);
            await call('patient','POST','/privacy/requests/not-a-uuid/export',{currentPassword:password},400);
        });
        await t.test('only explicit matching owner confirmation is accepted and retries preserve the same receipt',async()=>{
            const route=`/privacy/requests/${own.id}/receipts/${exported.receipt.id}/confirm`;
            const body={received:true,contentHash:exported.receipt.contentHash};
            await call('patient','POST',route,{...body,received:false},400);
            await call('patient','POST',route,{...body,contentHash:'0'.repeat(64)},400);
            await call('patient','POST',route,{...body,confirmedAt:'2020-01-01'},400);
            await call('otherPatient','POST',route,body,404); await call('officer','POST',route,body,403);
            await call('otherPatient','POST',`/privacy/requests/${other.id}/receipts/${exported.receipt.id}/confirm`,body,404);
            const first=(await call('patient','POST',route,body)).data;
            assert.ok(first.confirmedAt); assert.equal(first.id,exported.receipt.id);
            assert.deepEqual((await call('patient','POST',route,body)).data,first);
            assert.equal((await call('patient','GET','/privacy/requests')).data[0].status,'in_review');
            assert.equal((await call('otherPatient','GET','/privacy/requests')).data[0].evidence.exports.length,0);
        });
        await t.test('receipt rows cannot be rewritten or deleted even by ordinary owner SQL',async()=>{
            await assert.rejects(db.query('UPDATE privacy_export_receipts SET content_hash=$1 WHERE id=$2',['0'.repeat(64),exported.receipt.id]),/immutable/);
            await assert.rejects(db.query('DELETE FROM privacy_export_confirmations WHERE receipt_id=$1',[exported.receipt.id]),/immutable/);
        });
    });
});
