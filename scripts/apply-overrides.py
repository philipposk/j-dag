"""Address-based overrides. Coordinates still come from Nominatim, never guessed."""
import json,pathlib,urllib.request,urllib.parse,time,re
root=pathlib.Path(__file__).resolve().parents[1]
vp=root/'data/venues.json';cp=root/'data/geocode-cache.json'
venues=json.loads(vp.read_text());cache=json.loads(cp.read_text());overrides=json.loads((root/'data/overrides.json').read_text())
for name,override in overrides.items():
 v=next((v for v in venues if v['name']==name),None)
 if not v:continue
 q=override['address']+', Denmark'
 if q not in cache:
  time.sleep(1.2)
  url='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q,'format':'jsonv2','addressdetails':1,'limit':3,'countrycodes':'dk'})
  cache[q]=json.load(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'JDayCopenhagenFinder/1.0 (https://6x7.gr)'}),timeout=25))
  cp.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n')
 rows=cache[q];number=re.search(r'\d+',q).group()
 matches=[r for r in rows if r.get('address',{}).get('house_number')==number and 55.59<float(r['lat'])<55.76 and 12.42<float(r['lon'])<12.68]
 if len(matches)!=1:print('ADDRESS UNVERIFIED',name,len(matches),flush=True);continue
 r=matches[0]
 v.update(verified=True,address=override['address'],lat=float(r['lat']),lng=float(r['lon']),geocoded={'source':'Nominatim / OpenStreetMap address match','query':q,'osm_type':r['osm_type'],'osm_id':r['osm_id'],'address_source':override['source'],'matched_address':r['display_name']})
 v.pop('reason',None);print('ADDRESS VERIFIED',name,v['address'],v['lat'],v['lng'],flush=True)
vp.write_text(json.dumps(venues,ensure_ascii=False,indent=2)+'\n')
print('TOTAL',sum(v['verified'] for v in venues),'of',len(venues))
