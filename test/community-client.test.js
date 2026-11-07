import test from 'node:test';import assert from 'node:assert/strict';
import { validateSuggestion, submissionKey, postJson, outcome, toVenue } from '../src/community.js';
import { foldName, inBbox, validateReport } from '../src/community-shared.js';
const ok={name:'Bodega Ærø',address:'Øster Allé 5, 2100 København Ø',source:''};
test('validation: required, length, http(s) only, no markup characters',()=>{
  assert.deepEqual(validateSuggestion(ok),{});
  assert.deepEqual(Object.keys(validateSuggestion({name:' ',address:'',source:''})).sort(),['address','name']);
  for(const s of ['javascript:alert(1)','ftp://a.dk','not a url','https://u:p@x.dk'])assert.equal(validateSuggestion({...ok,source:s}).source,'url',s);
  assert.equal(validateSuggestion({...ok,name:'<img onerror=x>'}).name,'chars');
  assert.equal(validateSuggestion({...ok,name:'‮'}).name,'required');
  assert.ok(Object.keys(validateReport({barId:'x',reason:'nope'})).length===2);
});
test('folding treats case, accents and Danish letters alike',()=>{
  assert.equal(foldName('BODEGA ÆRØ!'),foldName('bodega aero'));assert.equal(foldName('Café Åen'),'cafe aaen');
  assert.ok(inBbox(55.68,12.57));assert.ok(!inBbox(55.605,13.0));assert.ok(!inBbox(NaN,12.5));
});
test('same text keeps the same key; different text changes it',()=>{
  assert.equal(submissionKey(ok,'s1'),submissionKey({...ok},'s1'));assert.notEqual(submissionKey(ok,'s1'),submissionKey({...ok,name:'X'},'s1'));
  assert.match(submissionKey(ok,'abcdefgh'),/^[A-Za-z0-9-]{8,64}$/);
});
test('only real server success counts as success; network failure is not',async()=>{
  assert.equal(outcome('add',await postJson({},async()=>{throw new Error('offline')})),'failed');
  assert.equal(outcome('add',{status:201,data:{status:'added'}}),'added');
  assert.equal(outcome('add',{status:200,data:{}}),'failed');
  for(const s of ['official','duplicate','address','area'])assert.equal(outcome('add',{status:409,data:{status:s}}),s);
  assert.equal(outcome('add',{status:503,data:{error:'busy'}}),'busy');assert.equal(outcome('add',{status:503,data:{}}),'unavailable');
  assert.equal(outcome('add',{status:429,data:{}}),'rate');
  assert.equal(outcome('report',{status:200,data:{status:'reported'}}),'reported');assert.equal(outcome('report',{status:500,data:{}}),'runavailable');
  assert.equal(outcome('report',{status:0,data:{}}),'runavailable');
});
test('server rows are sanitized before display',()=>{
  assert.equal(toVenue({id:'1',name:'x',address:'y',lat:'a',lng:1}),null);
  const v=toVenue({id:'1',name:'A\u202eB',address:'y',lat:55.68,lng:12.57,sourceUrl:'javascript:alert(1)'});
  assert.equal(v.sourceUrl,null);assert.equal(v.name,'A B');assert.equal(v.community,true);
});
