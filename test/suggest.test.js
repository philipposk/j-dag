import test from 'node:test';import assert from 'node:assert/strict';
import { validateSuggestion, LIMITS, submitSuggestion, resultKey } from '../src/suggest.js';
const ok={name:'Bodega Ærø',address:'Øster Allé 5, 2100 København Ø',source:''};
test('requires name and address, bounds lengths, source http(s) only',()=>{
  assert.deepEqual(validateSuggestion(ok),{});
  assert.deepEqual(Object.keys(validateSuggestion({name:' ',address:'',source:''})).sort(),['address','name']);
  assert.equal(validateSuggestion({...ok,name:'x'.repeat(LIMITS.name+1)}).name,'long');
  for(const s of ['javascript:alert(1)','ftp://a.dk','not a url'])assert.equal(validateSuggestion({...ok,source:s}).source,'url');
  assert.deepEqual(validateSuggestion({...ok,source:'https://bar.dk/menu'}),{});
});
test('posts only the form fields to /api/suggest-bar (no location, no search)',async()=>{
  let call;const r=await submitSuggestion({...ok,lat:55.6,search:'x'},{lang:'da',startedAt:1,website:'',key:'abc'},async(u,o)=>{call={u,o};return {status:200,json:async()=>({ok:true})}});
  assert.equal(r,'sent');assert.equal(call.u,'/api/suggest-bar');assert.equal(call.o.method,'POST');
  assert.deepEqual(Object.keys(JSON.parse(call.o.body)).sort(),['address','key','lang','name','source','startedAt','website']);
  assert.match(call.o.body,/Ærø/);
});
test('maps outcomes honestly; network failure is not success',async()=>{
  const f=s=>async()=>({status:s,json:async()=>({})});
  assert.equal(await submitSuggestion(ok,{},f(429)),'rate');assert.equal(await submitSuggestion(ok,{},f(503)),'unavailable');
  assert.equal(await submitSuggestion(ok,{},f(502)),'failed');assert.equal(await submitSuggestion(ok,{},f(400)),'failed');
  assert.equal(await submitSuggestion(ok,{},async()=>{throw new Error('offline')}),'failed');
});
test('retry key stays the same for the same text and changes when text changes',()=>{
  assert.equal(resultKey(ok,'s1'),resultKey({...ok},'s1'));assert.notEqual(resultKey(ok,'s1'),resultKey({...ok,name:'Other'},'s1'));
  assert.match(resultKey(ok,'s1'),/^[A-Za-z0-9-]{1,64}$/);
});
