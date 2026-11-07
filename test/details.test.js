import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rankVenues, nearbyPage, NEARBY_STEP } from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));

const enrichment=read('../data/enrichment.json'),manual=read('../data/enrichment-manual.json'),venues=read('../data/venues.json'),metadata=read('../data/metadata.json');
const { venueDetails, matchesFilters, DEFAULT_FILTERS, SMOKING_GROUPS, activeFilterCount } = await import('../src/details.js');
const D=v=>venueDetails(v,enrichment,manual.facts);
const F=(o={})=>({...DEFAULT_FILTERS,...o});
const at={lat:55.6832,lng:12.5717};
const pass=(f,o=at)=>venues.filter(v=>v.verified&&matchesFilters(v,f,o,D(v)));

test('roster source and 132 pins untouched by enrichment',()=>{
 assert.equal(venues.length,132);assert.equal(venues.filter(v=>v.verified).length,132);
 assert.equal(metadata.sourceUrl,'https://migogkbh.dk/oel-og-nisser-paa-j-dag-i-koebenhavn/');
 assert.match(enrichment.license,/ODbL/);
 for(const [k,e] of Object.entries(enrichment.venues)){assert.ok(venues.some(v=>v.name.toLowerCase()===k),k);assert.match(e.osm.url,/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);assert.ok(e.osm.distance_m<=80);}
});
test('no filters keeps all bars; reset count is zero',()=>{assert.equal(pass(F()).length,132);assert.equal(activeFilterCount(F()),0);assert.equal(activeFilterCount(F({outdoor:true,district:'FREDERIKSBERG'})),2);});
test('name search is accent/case-insensitive',()=>{assert.deepEqual(pass(F({name:'norreport'})).map(v=>v.name),['Nørreport Bodega']);assert.equal(pass(F({name:'zzzz'})).length,0);});
test('district and radius filters',()=>{
 const fb=pass(F({district:'FREDERIKSBERG'}));assert.ok(fb.length>0&&fb.every(v=>v.district==='FREDERIKSBERG'));
 const r=pass(F({radius:500}));assert.ok(r.length>0&&r.length<132);
 assert.equal(pass(F({radius:500}),null).length,132,'radius ignored without a starting point');
});
test('attribute filters exclude unknowns and keep exact smoking semantics',()=>{
 const inside=pass(F({smoking:'inside'})),outside=pass(F({smoking:'outside'})),none=pass(F({smoking:'none'}));
 for(const v of inside)assert.ok(SMOKING_GROUPS.inside.includes(D(v).smoking));
 for(const v of outside)assert.equal(D(v).smoking,'outside');
 for(const v of none)assert.equal(D(v).smoking,'no');
 const known=venues.filter(v=>D(v).smoking!==null).length;assert.ok(inside.length+outside.length+none.length<=known);
 for(const v of pass(F({outdoor:true})))assert.equal(D(v).outdoorSeating,true);
 for(const v of pass(F({wheelchair:'some'})))assert.ok(['yes','limited'].includes(D(v).wheelchair));
 assert.ok(pass(F({wheelchair:'yes'})).length<=pass(F({wheelchair:'some'})).length);
});
test('combined filters can give no matches, and outdoor seating never implies smoking',()=>{
 assert.equal(pass(F({name:'Nørreport',smoking:'outside',district:'VALBY + VANLØSE'})).length,0);
 const v=venues.find(v=>D(v).outdoorSeating===true&&D(v).smoking===null);if(v)assert.equal(matchesFilters(v,F({smoking:'outside'}),at,D(v)),false);
});
test('filtered ranking feeds closest and show-more consistently',()=>{
 const f=F({district:'KØBENHAVN V'});const ranked=rankVenues(venues.filter(v=>matchesFilters(v,f,at,D(v))),at);
 assert.ok(ranked.every(v=>v.district==='KØBENHAVN V'));
 let shown=3,p=nearbyPage(ranked,shown);while(p.remaining){shown+=NEARBY_STEP;p=nearbyPage(ranked,shown);}
 assert.equal(p.items.length,ranked.length-1);assert.ok(!p.items.some(v=>v.name===ranked[0].name));
});
test('stale enrichment is ignored when a venue pin moves; Anker stays tentative',()=>{
 const anker=venues.find(v=>v.name==='Anker');assert.equal(anker.tentative,true);
 const moved={...anker,lat:anker.lat+0.01};assert.equal(D(moved).osmUrl,null);
 const unknown=D({name:'Not a real bar',lat:55.68,lng:12.57});assert.equal(unknown.smoking,null);assert.deepEqual(unknown.beerPrices,[]);
});
test('manual beer prices cite a source and never invent a size',()=>{
 for(const [k,f] of Object.entries(manual.facts))for(const p of f.beerPrice||[]){assert.match(p.source,/^https:\/\//);assert.ok(Number.isFinite(p.priceDkk));assert.ok(p.size===null||/cl$/.test(p.size));assert.ok(venues.some(v=>v.name.toLowerCase()===k));}
});
