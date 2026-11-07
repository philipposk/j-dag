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
