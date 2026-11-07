import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import { seoHtml, SITE } from '../seo.config.mjs';
const venues=JSON.parse(fs.readFileSync('data/venues.json'));
for (const [lang,path] of [['en','/'],['da','/da/']]) test(`static ${lang} page is crawlable and self-canonical`,()=>{
  const {head,body}=seoHtml(lang);
  assert.match(head,new RegExp(`rel="canonical" href="${SITE}${path}"`));
  for (const h of ['en','da','x-default']) assert.match(head,new RegExp(`hreflang="${h}"`));
  assert.match(head,/og:image" content="https:\/\/j-dag\.6x7\.gr\/og\.png"/);
  const ld=JSON.parse(head.match(/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(ld['@type'],'WebApplication');assert.equal(ld.aggregateRating,undefined);
  assert.equal((body.match(/<h1/g)||[]).length,1);
  assert.equal((body.match(/<li>/g)||[]).length,venues.length);
  assert.match(body,/\(2026, /);
  const tent=venues.filter(v=>v.tentative);assert.ok(tent.length>0);
  for(const v of tent)assert.match(body,new RegExp(`${v.name}[^<]*<small>\\((Likely location only|Kun sandsynlig placering)`));
  assert.equal((body.match(/<small>/g)||[]).length,tent.length);
});
test('robots allows crawling and sitemap lists only canonical pages',()=>{
  const r=fs.readFileSync('public/robots.txt','utf8');assert.doesNotMatch(r,/Disallow:\s*\/\s*$/m);assert.match(r,/Sitemap: https:\/\/j-dag\.6x7\.gr\/sitemap\.xml/);
  const locs=[...fs.readFileSync('public/sitemap.xml','utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
  assert.deepEqual(locs,[SITE+'/',SITE+'/da/']);
});
test('language switch rewrites head metadata to the target page',async()=>{
  const {applyHeadCopy,SEO_COPY}=await import('../src/seo-copy.js');
  const attrs={};const el=k=>({setAttribute:(a,v)=>{attrs[k]=v}});const doc={title:'',querySelector:el};
  applyHeadCopy('da',doc);assert.equal(doc.title,SEO_COPY.da.title);
  assert.equal(attrs['link[rel="canonical"]'],SITE+'/da/');assert.equal(attrs['meta[property="og:locale"]'],'da_DK');
});
