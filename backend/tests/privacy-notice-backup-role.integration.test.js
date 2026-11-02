const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {Client}=require('pg');
const {migrate,readMigrations}=require('../src/database/migrate');
test('an existing SELECT-only backup login can dump notices and sequence state after the 033 upgrade',{skip:process.env.RUN_DB_TESTS!=='true',timeout:60000},async()=>{
    assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.DB_HOST,'127.0.0.1');assert.equal(String(process.env.DB_PORT),'55432');
    const config={host:'127.0.0.1',port:55432,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const admin=new Client({...config,database:process.env.DB_NAME});await admin.connect();
    const database=`healthcare_noticebackup_${process.pid}`,password='synthetic-backup-fixture-only-'.repeat(2);let source,created=false,roleCreated=false;
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'notice-backup-role-'));
    try{
        assert.equal((await admin.query("SELECT 1 FROM pg_roles WHERE rolname='healthcare_backup'")).rowCount,0,'Never overwrite an existing role');
        await admin.query(`CREATE DATABASE "${database}"`);created=true;
        source=new Client({...config,database});await source.connect();
        await source.query('CREATE SCHEMA healthcare; CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions; CREATE EXTENSION btree_gist SCHEMA healthcare; SET search_path=healthcare,extensions,public');
        await migrate(source,{migrations:readMigrations().filter(value=>value.id<'033'),log(){}});
        const provisioning=await fs.readFile(path.resolve(__dirname,'../scripts/backup-reader-role.sql'),'utf8');
        await source.query(provisioning.replaceAll('__BACKUP_READER_PASSWORD__',password));roleCreated=true;
        await migrate(source,{log(){}});
        const output=path.join(directory,'snapshot.shmsbkp');
        const env={...process.env,DB_NAME:database,DB_USER:'healthcare_backup',DB_PASSWORD:password,BACKUP_DATABASE_SCHEMA:'healthcare',BACKUP_ENCRYPTION_KEY:'e'.repeat(64),FILE_STORAGE_BACKEND:'postgres',UPLOAD_PATH:directory};
        await require('../scripts/coordinated-backup').createCoordinatedBackup({output,env});
        const manifest=await require('../scripts/backup-helper').inspectBundle(output,Buffer.from(env.BACKUP_ENCRYPTION_KEY,'hex'));
        assert.ok(manifest.consistency.tables.some(value=>value.name==='privacy_notice_versions'));
        await source.query('SET ROLE healthcare_backup');
        assert.equal((await source.query('SELECT last_value FROM healthcare.privacy_notice_versions_version_number_seq')).rowCount,1);
        await assert.rejects(source.query("SELECT nextval('healthcare.privacy_notice_versions_version_number_seq')"),/permission|read.only/i);
        await assert.rejects(source.query('DELETE FROM healthcare.privacy_notice_versions'),/permission|read.only/i);
    }finally{
        if(source){await source.query('RESET ROLE').catch(()=>{});await source.end();}
        if(created)await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
        if(roleCreated)await admin.query('DROP ROLE healthcare_backup');await admin.end();
        assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('notice-backup-role-'));await fs.rm(directory,{recursive:true,force:true});
    }
});
