import test from 'node:test';import assert from 'node:assert/strict';
import { handleSuggest, memoryLimiter, RECIPIENT, MAX_BODY } from '../server/suggest-core.js';
const ORIGIN='https://j-dag.6x7.gr';
const good={name:'Bodega Ærø',address:'Øster Allé 5, 2100 København Ø',source:'https://bar.dk',lang:'da',startedAt:1_000_000,website:'',key:'k1'};
function deps(over={}){const sent=[];return {sent,d:{env:{RESEND_API_KEY:'x'},now:()=>1_000_000+10_000,limiter:memoryLimiter(),send:async m=>{sent.push(m);return {ok:true}},...over}};}
const req=(body,h={})=>({method:'POST',headers:{origin:ORIGIN,'content-type':'application/json','x-forwarded-for':'1.2.3.4',...h},body:typeof body==='string'?body:JSON.stringify(body)});
test('valid suggestion is sent once to the fixed recipient as plain text',async()=>{
  const {sent,d}=deps();const r=await handleSuggest(req(good),d);
  assert.equal(r.status,200);assert.equal(sent.length,1);const m=sent[0];
  assert.deepEqual(m.to,[RECIPIENT]);assert.equal(RECIPIENT,'filippos@6x7.gr');assert.equal(m.html,undefined);
  assert.ok(m.text.includes('Bodega Ærø')&&m.text.includes('Øster Allé 5')&&m.text.includes('https://bar.dk'));
  assert.equal(m.idempotencyKey,'jdag-suggest-k1');assert.equal(m.replyTo,undefined);
});
test('client cannot set recipient, sender, subject or headers',async()=>{
  const {sent,d}=deps();await handleSuggest(req({...good,to:'x@evil.com',from:'a@b.c',subject:'hi',cc:'q@r.s',name:'A\r\nBcc: x@evil.com'}),d);
  assert.deepEqual(sent[0].to,[RECIPIENT]);assert.doesNotMatch(sent[0].subject,/[\r\n]|hi$/);assert.equal(sent[0].from,undefined);assert.doesNotMatch(JSON.stringify({to:sent[0].to,cc:sent[0].cc,bcc:sent[0].bcc}),/evil|q@r/);
});
test('rejects bad method, origin, content type, size, json, and invalid fields',async()=>{
  const {sent,d}=deps();
  assert.equal((await handleSuggest({...req(good),method:'GET'},d)).status,405);
  assert.equal((await handleSuggest(req(good,{origin:'https://evil.example'}),d)).status,403);
  assert.equal((await handleSuggest(req(good,{origin:undefined}),d)).status,403);
  assert.equal((await handleSuggest(req(good,{'content-type':'text/plain'}),d)).status,415);
  assert.equal((await handleSuggest(req('x'.repeat(MAX_BODY+1)),d)).status,413);
  assert.equal((await handleSuggest(req('{nope'),d)).status,400);
  const bad=await handleSuggest(req({...good,source:'javascript:alert(1)',name:''}),d);
  assert.equal(bad.status,400);assert.deepEqual(Object.keys(bad.body.errors).sort(),['name','source']);
  assert.equal(sent.length,0);
});
test('honeypot and too-fast submissions look accepted but send nothing',async()=>{
  const {sent,d}=deps();
  assert.equal((await handleSuggest(req({...good,website:'http://spam'}),d)).status,200);
  assert.equal((await handleSuggest(req({...good,startedAt:1_000_000+9_000}),d)).status,200);
  assert.equal(sent.length,0);
});
test('per-IP limit returns 429 after 3 sends in the window; global daily cap too',async()=>{
  const {sent,d}=deps();for(let i=0;i<3;i++)assert.equal((await handleSuggest(req({...good,key:'k'+i}),d)).status,200);
  const r=await handleSuggest(req({...good,key:'k9'}),d);assert.equal(r.status,429);assert.equal(sent.length,3);
  const {d:d2}=deps();let last;for(let i=0;i<40;i++)last=await handleSuggest(req({...good,key:'g'+i},{'x-forwarded-for':'9.9.9.'+i}),d2);assert.equal(last.status,429);
});
test('missing key -> 503 and provider failure -> 502, nothing claims success',async()=>{
  assert.equal((await handleSuggest(req(good),deps({env:{}}).d)).status,503);
  assert.equal((await handleSuggest(req(good),deps({send:async()=>({ok:false})}).d)).status,502);
  assert.equal((await handleSuggest(req(good),deps({send:async()=>{throw new Error('net')}}).d)).status,502);
});
test('preview origin only allowed outside production',async()=>{
  const o={origin:'http://localhost:4173'};
  assert.equal((await handleSuggest(req(good,o),deps({env:{RESEND_API_KEY:'x',VERCEL_ENV:'production'}}).d)).status,403);
  assert.equal((await handleSuggest(req(good,o),deps({env:{RESEND_API_KEY:'x'}}).d)).status,200);
});
