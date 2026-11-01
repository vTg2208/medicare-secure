const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { migrate, readMigrations } = require('../src/database/migrate');
const { buildBrowserSchemaSql } = require('../scripts/export-browser-schema');

test('runtime roles cannot move the audit head through their own nested triggers', {
    skip: process.env.RUN_DB_TESTS !== 'true', timeout: 60000,
}, async t => {
    assert.equal(process.env.NODE_ENV,'test');
    assert.equal(process.env.DB_HOST,'127.0.0.1');
    assert.equal(process.env.DB_PORT,'55432');
    assert.match(process.env.DB_NAME,/test/);
    const settings={host:'127.0.0.1',port:55432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:false};
    const owner=new Client(settings); await owner.connect();
    const originalDatabase=process.env.DB_NAME;
    try {
        for (const schema of ['public','healthcare']) await t.test(`${schema} schema denies nested-head tampering but accepts ordinary audit inserts`,async()=>{
            const suffix=crypto.randomBytes(4).toString('hex');
            const database=`healthcare_head_test_${process.pid}_${suffix}`;
            const role=`head_runtime_${process.pid}_${suffix}`;
            const password=crypto.randomBytes(32).toString('hex');
            let fixture; let runtime;
            await owner.query(`CREATE DATABASE ${database}`);
            await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
            try {
                fixture=new Client({...settings,database}); await fixture.connect();
                if(schema==='healthcare') {
                    // Hosted owners may have inherited broad default grants.
                    await fixture.query(`ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO ${role}`);
                    await fixture.query(`ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO ${role}`);
                    await fixture.query(buildBrowserSchemaSql());
                    await fixture.query(`GRANT USAGE ON SCHEMA healthcare TO ${role}`);
                    await fixture.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA healthcare TO ${role}`);
                } else {
                    await migrate(fixture,{log(){}});
                    process.env.DB_NAME=database; process.env.DB_APP_USER=role; process.env.DB_APP_PASSWORD=password;
                    await require('../scripts/provision-app-role').main();
                }
                runtime=new Client({...settings,database,user:role,password}); await runtime.connect();
                const before=(await fixture.query(`SELECT last_hash FROM ${schema}.audit_chain_head`)).rows[0].last_hash;
                await runtime.query('BEGIN');
                try {
                    await runtime.query('CREATE TEMP TABLE head_probe(id INTEGER) ON COMMIT DROP');
                    await runtime.query(`CREATE FUNCTION pg_temp.move_head() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE ${schema}.audit_chain_head SET last_hash='forged-head-probe'; RETURN NEW; END $$`);
                    await runtime.query('CREATE TRIGGER head_probe BEFORE INSERT ON head_probe FOR EACH ROW EXECUTE FUNCTION pg_temp.move_head()');
                    await assert.rejects(runtime.query('INSERT INTO head_probe VALUES(1)'),error=>error.code==='42501');
                } finally { await runtime.query('ROLLBACK'); }
                assert.equal((await runtime.query(`SELECT has_table_privilege(current_user,'${schema}.audit_logs','TRIGGER') AS allowed`)).rows[0].allowed,false);
                assert.equal((await fixture.query(`SELECT last_hash FROM ${schema}.audit_chain_head`)).rows[0].last_hash,before);
                await assert.rejects(runtime.query(`UPDATE ${schema}.audit_chain_head SET last_hash='direct-forgery'`),error=>error.code==='42501');
                await runtime.query('BEGIN');
                try {
                    await runtime.query('CREATE TEMP TABLE chain_probe(id INTEGER) ON COMMIT DROP');
                    await assert.rejects(runtime.query(`CREATE TRIGGER chain_probe BEFORE INSERT ON chain_probe FOR EACH ROW EXECUTE FUNCTION ${schema}.chain_audit_insert()`),error=>error.code==='42501');
                } finally { await runtime.query('ROLLBACK'); }
                // Existing triggers continue running despite caller EXECUTE revocation.
                await runtime.query(`INSERT INTO ${schema}.audit_logs(action) VALUES('restricted_role_fixture')`);
                const event=(await fixture.query(`SELECT current_hash,previous_hash,hash_version FROM ${schema}.audit_logs ORDER BY sequence DESC LIMIT 1`)).rows[0];
                assert.equal(event.hash_version,1); assert.equal(event.previous_hash||'',before||'');
                assert.equal((await runtime.query(`SELECT last_hash FROM ${schema}.audit_chain_head`)).rows[0].last_hash,event.current_hash);
                assert.equal((await runtime.query('SELECT has_function_privilege(current_user,$1,\'EXECUTE\') AS allowed',[`${schema}.chain_audit_insert()`])).rows[0].allowed,false);
                const digestSchema=(await fixture.query("SELECT quote_ident(n.nspname) AS name FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto'")).rows[0].name;
                const invalid=(await fixture.query(`SELECT COUNT(*)::int AS count FROM ${schema}.audit_logs a WHERE current_hash<>encode(${digestSchema}.digest(COALESCE(previous_hash,'')||${schema}.audit_payload(a),'sha256'),'hex')`)).rows[0].count;
                assert.equal(invalid,0);
                if(schema==='public') {
                    // Reprovisioning broad application data rights must not reopen head writes.
                    await require('../scripts/provision-app-role').main();
                    assert.equal((await runtime.query(`SELECT has_table_privilege(current_user,'public.audit_chain_head','UPDATE') AS allowed`)).rows[0].allowed,false);
                }
            } finally {
                if(runtime) await runtime.end();
                if(fixture) await fixture.end();
                await owner.query(`DROP DATABASE ${database} WITH (FORCE)`);
                await owner.query(`DROP ROLE ${role}`);
            }
        });
        await t.test('upgrades block pre-existing temporary triggers without expanding read-only or column-only grants',async()=>{
            const suffix=crypto.randomBytes(4).toString('hex');
            const database=`healthcare_head_upgrade_${process.pid}_${suffix}`;
            const role=`head_upgrade_${process.pid}_${suffix}`;
            const monitor=`${role}_m`; const column=`${role}_c`;
            const password=crypto.randomBytes(32).toString('hex');
            let fixture; let runtime;
            await owner.query(`CREATE DATABASE ${database}`);
            for(const principal of [role,monitor,column]) await owner.query(`CREATE ROLE ${principal} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`);
            try {
                fixture=new Client({...settings,database}); await fixture.connect();
                const migrations=readMigrations();
                await migrate(fixture,{migrations:migrations.filter(item=>item.id<'025_private_audit_head'),log(){}});
                await fixture.query(`GRANT USAGE ON SCHEMA public TO ${role},${monitor},${column}`);
                await fixture.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
                await fixture.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
                await fixture.query(`GRANT SELECT ON audit_logs,audit_chain_head TO ${monitor}`);
                await fixture.query(`GRANT SELECT(current_hash) ON audit_logs TO ${column}`);
                await fixture.query(`GRANT UPDATE(last_hash) ON audit_chain_head TO ${column}`);
                runtime=new Client({...settings,database,user:role,password}); await runtime.connect();
                await runtime.query('CREATE TEMP TABLE old_chain_probe (LIKE public.audit_logs INCLUDING DEFAULTS)');
                await runtime.query('CREATE TRIGGER old_chain_probe BEFORE INSERT ON old_chain_probe FOR EACH ROW EXECUTE FUNCTION public.chain_audit_insert()');
                await migrate(fixture,{log(){}});
                const before=(await fixture.query('SELECT last_hash FROM audit_chain_head')).rows[0].last_hash;
                await runtime.query('BEGIN');
                try { await assert.rejects(runtime.query("INSERT INTO old_chain_probe(action) VALUES('preupgrade_trigger_probe')"),error=>error.code==='42501'); }
                finally { await runtime.query('ROLLBACK'); }
                assert.equal((await fixture.query('SELECT last_hash FROM audit_chain_head')).rows[0].last_hash,before);
                const privileges=(await fixture.query(`SELECT
                    has_table_privilege($1,'public.audit_logs','SELECT') AS monitor_select,
                    has_table_privilege($1,'public.audit_logs','INSERT') AS monitor_insert,
                    has_column_privilege($2,'public.audit_logs','current_hash','SELECT') AS column_select,
                    has_column_privilege($2,'public.audit_logs','action','SELECT') AS other_column_select,
                    has_column_privilege($2,'public.audit_chain_head','last_hash','UPDATE') AS head_update`,[monitor,column])).rows[0];
                assert.deepEqual(privileges,{monitor_select:true,monitor_insert:false,column_select:true,other_column_select:false,head_update:false});
                await runtime.query("INSERT INTO public.audit_logs(action) VALUES('postupgrade_retained_fixture')");
            } finally {
                if(runtime) await runtime.end(); if(fixture) await fixture.end();
                await owner.query(`DROP DATABASE ${database} WITH (FORCE)`);
                for(const principal of [role,monitor,column]) await owner.query(`DROP ROLE ${principal}`);
            }
        });
    } finally {
        process.env.DB_NAME=originalDatabase;
        delete process.env.DB_APP_USER; delete process.env.DB_APP_PASSWORD;
        await owner.end();
    }
});
