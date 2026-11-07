import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { distanceMeters, rankVenues, walkingEstimate, directionsLink, TRAVEL_MODES } from '../src/geo.js';
const venues = JSON.parse(fs.readFileSync(new URL('../data/venues.json',import.meta.url)));
test('distance calculation is symmetric and zero at same point',()=>{
 const a={lat:55.68,lng:12.57}, b={lat:55.69,lng:12.58};
 assert.equal(distanceMeters(a,a),0);assert.equal(distanceMeters(a,b),distanceMeters(b,a));
 assert.ok(distanceMeters(a,b)>1000 && distanceMeters(a,b)<1500);
});
test('unverified and invalid venues never rank',()=>{
 const rows=[{name:'unverified',verified:false,lat:55,lng:12},{name:'bad',verified:true},{name:'valid',verified:true,lat:55,lng:12}];
 assert.deepEqual(rankVenues(rows,{lat:55,lng:12}).map(v=>v.name),['valid']);
});
test('Nørreport Bodega is closest to the supplied Nørreport station area',()=>{
 const results=rankVenues(venues,{lat:55.6832,lng:12.5717});
 assert.equal(results[0].name,'Nørreport Bodega');assert.ok(results[0].distance<120);
});
test('source roster has unique names and coordinates are inside Copenhagen',()=>{
 assert.ok(venues.length>=80&&venues.length<=300);assert.equal(new Set(venues.map(v=>v.name)).size,venues.length);
 for(const v of venues.filter(v=>v.verified)){assert.ok(v.lat>55.59&&v.lat<55.76);assert.ok(v.lng>12.42&&v.lng<12.68);assert.ok(v.geocoded||v.coordinate_note);}
});
test('walking estimate labelled heuristic, directions request real walking route',()=>{
 assert.equal(walkingEstimate(100),130);
 const u=new URL(directionsLink({lat:55.682486,lng:12.571489},{lat:55.6832,lng:12.5717}));
 assert.equal(u.searchParams.get('travelmode'),'walking');assert.equal(u.searchParams.get('origin'),'55.6832,12.5717');
});
test('every travel mode produces an official Maps URL with that mode, and unknown modes fall back to walking',()=>{
 for(const m of TRAVEL_MODES){const u=new URL(directionsLink({lat:55.68,lng:12.57},{lat:55.69,lng:12.58},m));assert.equal(u.origin+u.pathname,'https://www.google.com/maps/dir/');assert.equal(u.searchParams.get('api'),'1');assert.equal(u.searchParams.get('travelmode'),m);}
 assert.deepEqual(TRAVEL_MODES,['walking','bicycling','transit','driving']);
 assert.equal(new URL(directionsLink({lat:1,lng:2},null,'teleport')).searchParams.get('travelmode'),'walking');
 assert.equal(new URL(directionsLink({lat:1,lng:2})).searchParams.has('origin'),false);
});
test('every address override is mapped with a cited source and a matching street',()=>{
 const overrides=JSON.parse(fs.readFileSync(new URL('../data/overrides.json',import.meta.url)));
 for(const [name,o] of Object.entries(overrides)){const v=venues.find(v=>v.name===name);assert.ok(v,name);assert.ok(v.verified,name);assert.ok(/https?:\/\//.test(o.source)||/^User-provided/.test(o.source),name);
  const street=o.address.split(/\s\d/)[0].toLowerCase();assert.ok(v.geocoded.matched_address.toLowerCase().includes(street),name);}
});
test('tentative venues are flagged, not presented as confirmed',()=>{
 const a=venues.find(v=>v.name==='Anker');assert.equal(a.tentative,true);
 const src=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');assert.ok(src.includes('v.tentative'));
});
test('nearby alternatives page in 3, then 10 more per click, never repeating the closest bar',async()=>{
 const {nearbyPage,NEARBY_INITIAL,NEARBY_STEP}=await import('../src/geo.js');
 const ranked=rankVenues(venues,{lat:55.6832,lng:12.5717});const total=ranked.length-1;
 let shown=NEARBY_INITIAL,p=nearbyPage(ranked,shown);
 assert.equal(p.items.length,3);assert.equal(p.remaining,total-3);assert.equal(p.next,10);
 assert.ok(!p.items.some(v=>v.name===ranked[0].name));
 shown+=NEARBY_STEP;p=nearbyPage(ranked,shown);assert.equal(p.items.length,13);
 while(p.remaining){shown+=NEARBY_STEP;p=nearbyPage(ranked,shown);}
 assert.equal(p.items.length,total);assert.equal(p.next,0);assert.equal(new Set(p.items.map(v=>v.name)).size,total);
 for(let i=1;i<p.items.length;i++)assert.ok(p.items[i-1].distance<=p.items[i].distance);
 assert.equal(nearbyPage(ranked,NEARBY_INITIAL).items[0].name,ranked[1].name); // reset = first page again
});
test('ranking is stable for equal distances',()=>{
 const rows=[{name:'B',verified:true,lat:55.68,lng:12.57},{name:'A',verified:true,lat:55.68,lng:12.57}];
 assert.deepEqual(rankVenues(rows,{lat:55.68,lng:12.571}).map(v=>v.name),['A','B']);
});
