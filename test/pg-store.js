// Test helper: the real migration in PGlite, exposed through the same store interface the server uses.
import fs from 'node:fs';import { PGlite } from '@electric-sql/pglite';
export async function pgStore(){
  const d=new PGlite();
  await d.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role; create schema cron;
    create function cron.schedule(n text, s text, c text) returns bigint language sql as 'select 1::bigint';`);
  await d.exec(fs.readFileSync('supabase/jdag-community.sql','utf8'));
  const call=async(q,p)=>{await d.exec('set role service_role');try{return (await d.query(q,p)).rows;}finally{await d.exec('reset role');}};
  const one=async(q,p)=>(await call(q,p))[0].r;
  const store={
    listBars:n=>call('select * from public.jdag_list_bars($1)',[n]),
    rateHit:(k,key,l,w)=>one('select public.jdag_rate_hit($1,$2,$3,$4) r',[k,key,l,w]),
    addBar:b=>one('select public.jdag_add_bar($1,$2,$3,$4,$5,$6,$7,$8,$9) r',[b.name,b.nameKey,b.address,b.source,b.lat,b.lng,b.osmRef,b.idem,b.who]),
    addReport:r=>one('select public.jdag_add_report($1,$2,$3,$4) r',[r.barId,r.reason,r.note,r.who]),
    markReportNotified:id=>call('select public.jdag_mark_report_notified($1)',[id]),
    nominatimSlot:()=>one('select public.jdag_nominatim_slot() r'),
    geocacheGet:k=>one('select public.jdag_geocache_get($1) r',[k]),
    geocachePut:(k,v)=>call('select public.jdag_geocache_put($1,$2)',[k,v]),
  };
  return {store,db:d};
}
