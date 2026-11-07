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
});
test('robots allows crawling and sitemap lists only canonical pages',()=>{
  const r=fs.readFileSync('public/robots.txt','utf8');assert.doesNotMatch(r,/Disallow:\s*\/\s*$/m);assert.match(r,/Sitemap: https:\/\/j-dag\.6x7\.gr\/sitemap\.xml/);
  const locs=[...fs.readFileSync('public/sitemap.xml','utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
  assert.deepEqual(locs,[SITE+'/',SITE+'/da/']);
});
