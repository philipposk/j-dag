"""Free venue details from OpenStreetMap (ODbL), stored separately from the roster.

Fetches bars/pubs/cafes/restaurants/nightclubs/hotels around Copenhagen in ONE
Overpass request (cached in data/osm-cache.json; pass --refresh to re-download),
then matches each roster venue to at most one OSM element: within 80 m of its pin
AND a name match. Ambiguous or weak matches are left unknown. Output:
data/enrichment.json keyed by venue name (casefolded), with the pin it was matched
against so a later roster change cannot silently reuse it for a moved venue.
Manual, cited facts (e.g. a menu price) live in data/enrichment-manual.json and win.
"""
import argparse,datetime,json,math,pathlib,re,unicodedata,urllib.request,urllib.parse
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--refresh',action='store_true');a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];cache=root/'data/osm-cache.json'
Q='[out:json][timeout:90];(nwr["amenity"~"^(bar|pub|cafe|restaurant|nightclub|biergarten|fast_food)$"](55.60,12.45,55.73,12.65);nwr["tourism"~"^(hotel|hostel)$"](55.60,12.45,55.73,12.65););out center tags;'
if a.refresh or not cache.exists():
 body=urllib.parse.urlencode({'data':Q}).encode()
 data=json.load(urllib.request.urlopen(urllib.request.Request('https://overpass-api.de/api/interpreter',data=body,headers={'User-Agent':'JDayCopenhagenFinder/1.0 (https://6x7.gr)'}),timeout=120))
 cache.write_text(json.dumps({'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'query':Q,'license':'ODbL 1.0, © OpenStreetMap contributors','elements':[{'type':e['type'],'id':e['id'],'lat':e.get('lat',e.get('center',{}).get('lat')),'lon':e.get('lon',e.get('center',{}).get('lon')),'tags':e.get('tags',{})} for e in data['elements']]},ensure_ascii=False)+'\n')
osm=json.loads(cache.read_text());manual=json.loads((root/'data/enrichment-manual.json').read_text())
REJECT={r['osm'] for r in manual.get('rejectMatches',[])};venues=json.loads((root/'data/venues.json').read_text())
STOP={'bar','pub','cafe','cafeen','the','og','and','bodega','bodegaen','irish','kro','restaurant','hotel','copenhagen','kobenhavn','karaokebar','–','-','&'}
def norm(s):
 s=unicodedata.normalize('NFKD',s.casefold().replace('ø','o').replace('æ','ae').replace('å','aa'))
 s=''.join(c for c in s if not unicodedata.combining(c));return re.findall(r'[a-z0-9]+',s)
def sim(a,b,extra=frozenset()):
 if norm(a)==norm(b):return 1.0
 A,B=set(norm(a))-STOP-extra,set(norm(b))-STOP-extra
 A={t for t in A if not t.isdigit() and len(t)>2};B={t for t in B if len(t)>2}
 if not A or not B:return 0.0
 if not A or not B:return 1.0 if norm(a)==norm(b) else 0.0
 return len(A&B)/min(len(A),len(B))
def dist(a,b,c,d):return 6371000*2*math.asin(math.sqrt(math.sin(math.radians(c-a)/2)**2+math.cos(math.radians(a))*math.cos(math.radians(c))*math.sin(math.radians(d-b)/2)**2))
FIELDS=['smoking','smoking:outside','outdoor_seating','wheelchair','opening_hours','website','contact:website','check_date','check_date:opening_hours']
out={};report=[]
for v in venues:
 if not v.get('verified'):continue
 cands=[]
 for e in osm['elements']:
  n=e['tags'].get('name');
  if not n or e['lat'] is None or f"{e['type']}/{e['id']}" in REJECT:continue
  d=dist(v['lat'],v['lng'],e['lat'],e['lon'])
  if d>80:continue
  # Street/area words (from the venue's own address) and bare numbers never count as a name match.
  place=frozenset(norm(v.get('address','')))|{'cph','amager','vesterbro','norrebro','osterbro','frederiksberg'}
  s=max([sim(v['name'],n,place)]+[sim(v['name'],e['tags'][k],place) for k in ('alt_name','official_name') if k in e['tags']])
  # A hotel's tags describe the hotel, not a pub/bar inside it.
  if 'amenity' not in e['tags'] and set(norm(v['name']))&{'pub','bar','bodega','cafe','kro'}:continue
  if s>=0.5:cands.append((s,-d,e,d))
 cands.sort(key=lambda c:(c[0],c[1]),reverse=True)
 if not cands:report.append((v['name'],'no match'));continue
 if len(cands)>1 and cands[1][0]==cands[0][0] and abs(cands[1][3]-cands[0][3])<10:report.append((v['name'],'ambiguous'));continue
 s,_,e,d=cands[0];t=e['tags']
 out[v['name'].casefold()]={'name':v['name'],'pin':[v['lat'],v['lng']],'osm':{'url':f"https://www.openstreetmap.org/{e['type']}/{e['id']}",'name':t.get('name'),'distance_m':round(d),'name_score':round(s,2)},
  'fields':{k:t[k] for k in FIELDS if k in t}}
 report.append((v['name'],f"matched {t.get('name')} {round(d)}m"))
(root/'data/enrichment.json').write_text(json.dumps({'source':'OpenStreetMap via Overpass API','license':'ODbL 1.0 — © OpenStreetMap contributors (https://www.openstreetmap.org/copyright)','osmFetchedAt':osm['fetchedAt'],'matchRule':'within 80 m of the venue pin and name token overlap ≥ 0.5; ambiguous matches skipped','venues':out},ensure_ascii=False,indent=1)+'\n')
for r in report:print(*r,sep=' | ')
print('MATCHED',len(out),'of',sum(1 for v in venues if v.get('verified')))
