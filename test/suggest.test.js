import test from 'node:test';import assert from 'node:assert/strict';
import { validateSuggestion, buildEmail, copyText, RECIPIENT, LIMITS } from '../src/suggest.js';
const ok={name:'Bodega Ærø',address:'Øster Allé 5, 2100 København Ø',source:''};
test('requires name and address, bounds lengths, source http(s) only',()=>{
  assert.deepEqual(validateSuggestion(ok),{});
  assert.deepEqual(Object.keys(validateSuggestion({name:' ',address:'',source:''})).sort(),['address','name']);
  assert.equal(validateSuggestion({...ok,name:'x'.repeat(LIMITS.name+1)}).name,'long');
  assert.equal(validateSuggestion({...ok,source:'javascript:alert(1)'}).source,'url');
  assert.equal(validateSuggestion({...ok,source:'ftp://a.dk'}).source,'url');
  assert.equal(validateSuggestion({...ok,source:'not a url'}).source,'url');
  assert.deepEqual(validateSuggestion({...ok,source:'https://bar.dk/menu'}),{});
});
test('mailto has fixed recipient, encodes æøå, cannot inject headers',()=>{
  const e=buildEmail({...ok,name:'Evil\r\nBcc: x@y.z&cc=a@b.c?to=q@r.s'},'da',2026);
  assert.ok(e.href.startsWith(`mailto:${RECIPIENT}?subject=`));
  assert.equal(e.href.indexOf('?'),`mailto:${RECIPIENT}`.length);
  assert.equal((e.href.match(/&/g)||[]).length,1); // only subject & body separator
  assert.doesNotMatch(e.href,/[\r\n]|%0D%0ABcc|\s/);
  const p=new URL(e.href);assert.equal(p.pathname,RECIPIENT);
  assert.deepEqual([...p.searchParams.keys()],['subject','body']);
  assert.ok(!p.searchParams.get('subject').includes('\n'));
  const e2=buildEmail(ok,'da',2026);assert.match(e2.href,/%C3%86r%C3%B8/);
  assert.equal(decodeURIComponent(e2.href.split('body=')[1]),e2.body);
});
test('body has fields, language and year; nothing else about the visitor',()=>{
  const e=buildEmail({...ok,source:'https://bar.dk'},'en',2026);
  for(const s of ['Bodega Ærø','Øster Allé 5','https://bar.dk','Language: en','2026'])assert.ok(e.body.includes(s),s);
  assert.doesNotMatch(e.body,/lat|lng|55\.\d|12\.\d/i);
  assert.match(e.subject,/^J-dag: missing bar – Bodega Ærø$/);
  assert.match(buildEmail(ok,'da',2026).subject,/^J-dag: manglende bar – /);
  assert.ok(e.text.includes(RECIPIENT)&&e.text.includes(e.body));
});
test('copyText reports success only when the clipboard write resolves',async()=>{
  assert.equal(await copyText('x',{writeText:async()=>{}}),true);
  assert.equal(await copyText('x',{writeText:async()=>{throw new Error('denied')}}),false);
  assert.equal(await copyText('x',undefined),false);
});
