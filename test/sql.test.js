// Runs the real migration in an in-memory Postgres (PGlite) with Supabase-like roles. No network, no real DB.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const sql=fs.readFileSync('supabase/jdag-community.sql','utf8');
async function db(){const d=new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create schema cron; create table cron.jobs(name text, sched text, cmd text);
    create function cron.schedule(n text, s text, c text) returns bigint language sql as 'insert into cron.jobs values(n,s,c) returning 1::bigint';`);
  await d.exec(sql);return d;}
const H='a'.repeat(64),H2='b'.repeat(64);
const asRole=async(d,role,q,p=[])=>{await d.exec(`set role ${role}`);try{return await d.query(q,p);}finally{await d.exec('reset role');}};
const add=(d,o={})=>asRole(d,'service_role',`select public.jdag_add_bar($1,$2,$3,$4,$5,$6,$7,$8,$9) r`,[o.name??'Bodega Ærø',o.key??'bodega aero','Øster Allé 5',o.src??null,o.lat??55.69,o.lng??12.57,o.osm??null,o.idem??'i1',H]).then(r=>r.rows[0].r);
test('migration applies; anon/authenticated cannot read tables or execute RPCs',async()=>{const d=await db();
  for(const role of ['anon','authenticated']){
    await assert.rejects(asRole(d,role,'select * from jdag.community_bars'));
    await assert.rejects(asRole(d,role,'select public.jdag_list_bars(10)'));
    await assert.rejects(asRole(d,role,`select public.jdag_add_report('00000000-0000-0000-0000-000000000000','spam',null,'${H}')`));
  }
  const f=await d.query(`select proname, prosecdef, proconfig from pg_proc where proname like 'jdag_%'`);
  assert.equal(f.rows.length,8);for(const r of f.rows){assert.equal(r.prosecdef,false,r.proname);assert.deepEqual(r.proconfig,['search_path=""'],r.proname);}
  const rls=await d.query(`select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='jdag' and relkind='r'`);
  assert.equal(rls.rows.length,5);for(const r of rls.rows)assert.equal(r.relrowsecurity,true,r.relname);
  assert.equal((await d.query('select count(*)::int n from cron.jobs')).rows[0].n,1);
});
test('add bar: idempotent repeat, duplicate by name+distance and OSM id, distinct neighbours allowed',async()=>{const d=await db();
  assert.equal((await add(d)).status,'added');
  assert.equal((await add(d)).repeat,true);
  assert.equal((await add(d,{idem:'i2',lat:55.6905})).status,'duplicate');           // ~55 m, same folded name
  assert.equal((await add(d,{idem:'i3',lat:55.70})).status,'added');                 // ~1.1 km away: different place
  assert.equal((await add(d,{idem:'i4',name:'Other',key:'other',osm:'node/1'})).status,'added');
  assert.equal((await add(d,{idem:'i5',name:'Renamed',key:'renamed',osm:'node/1',lat:55.65})).status,'duplicate');
  assert.equal((await asRole(d,'service_role','select count(*)::int n from public.jdag_list_bars(1000)')).rows[0].n,3);
  const cols=Object.keys((await asRole(d,'service_role','select * from public.jdag_list_bars(1)')).rows[0]).sort();
  assert.deepEqual(cols,['address','created_at','id','lat','lng','name','source_url']);
});
test('constraints reject out-of-area pins, bad URLs, long text',async()=>{const d=await db();
  await assert.rejects(add(d,{lat:56.1}));await assert.rejects(add(d,{src:'javascript:alert(1)'}));
  await assert.rejects(add(d,{name:'x'.repeat(121)}));await assert.rejects(add(d,{osm:'node/1;drop'}));
});
test('reports: one per reporter, never hides the bar, missing bar handled',async()=>{const d=await db();const {id}=await add(d);
  const rep=(h)=>asRole(d,'service_role',`select public.jdag_add_report($1,'spam','looks fake',$2) r`,[id,h]).then(r=>r.rows[0].r);
  assert.equal((await rep(H)).status,'added');assert.equal((await rep(H)).status,'duplicate');
  for(const c of 'cdef')assert.equal((await rep(c.repeat(64))).status,'added');
  assert.equal((await asRole(d,'service_role','select count(*)::int n from public.jdag_list_bars(10)')).rows[0].n,1);
  assert.equal((await asRole(d,'service_role',`select public.jdag_add_report('00000000-0000-0000-0000-000000000000','spam',null,$1) r`,[H])).rows[0].r.status,'missing');
  await assert.rejects(asRole(d,'service_role',`select public.jdag_add_report($1,'evil',null,$2)`,[id,H2]));
});
test('rate limit and Nominatim slot',async()=>{const d=await db();
  const hit=()=>asRole(d,'service_role',`select public.jdag_rate_hit('add',$1,2,600) r`,[H]).then(r=>r.rows[0].r);
  assert.equal(await hit(),true);assert.equal(await hit(),true);assert.equal(await hit(),false);
  const slot=()=>asRole(d,'service_role','select public.jdag_nominatim_slot() r').then(r=>r.rows[0].r);
  assert.equal(await slot(),true);assert.equal(await slot(),false);
});
