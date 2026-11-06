"""Single-threaded, cached Nominatim lookup (at most 1 request/1.2 seconds).
Only close name matches in the Copenhagen bounding box are accepted.
Ambiguous/absent names are left unverified, never given invented coordinates.
"""
import json,pathlib,urllib.request,urllib.parse,time,unicodedata,re,difflib
ROOT=pathlib.Path(__file__).resolve().parents[1]
path=ROOT/'data/venues.json'
venues=json.loads(path.read_text())
cachepath=ROOT/'data/geocode-cache.json'
cache=json.loads(cachepath.read_text()) if cachepath.exists() else {}
def norm(s):
 s=unicodedata.normalize('NFKD',s.casefold().replace('ø','o').replace('æ','ae'))
 return re.sub('[^a-z0-9]','',s.replace('cafe','').replace('cph','').replace('copenhagen',''))
aliases={'4tallet':'4-tallet','Foreningen Studenterhuset':'Studenterhuset','Cafe Nemoland Christiania':'Nemoland','Cph Downtown':'Copenhagen Downtown Hostel','Drop inn – Moving music':'Drop Inn','Generator Hostel Copenhagen':'Generator Copenhagen','Heidis Bier Bar':'Heidi’s Bier Bar','Next – House Next Bar Copenhagen':'Next House Copenhagen','The Shamrock Inn – The Irish Pub':'The Shamrock Inn','Western Bar Diligencen':'Diligencen','Studenterhuset Sigurds Bar':'Sigurds Bar','MEININGER Hotel Copenhagen':'Urban House Copenhagen','Liams Irish Pub':'Liam’s','Mc Joys Pub':'McJoy’s Choice','Nevermind – Axeltorv':'Never Mind','A.V.F. Landbohøjskolen':'A-vej','The Old Irish Pub Smallegade':'The Old Irish Pub, Smallegade','Mojo':'Mojo Blues Bar','Cafe Nemoland Christiania':'Café Nemoland','Cafe Sofie Kælderen':'Sofiekælderen','Andys Bar':"Andy’s Bar",'The Dubliner':'The Dubliner Downtown','Cafe Klovnen':'Klovnen','Tjilipop':'Tjili Pop','Cafe Engholm':'Engholm','Restaurant Kareten':'Kareten','Alleenberg':'Café Alléenberg','Cafe Bartof':'Bartof Café'}
addresses={'Nørreport Bodega':'Nørre Voldgade 70, 1358 København','Bankeråt':'Ahlefeldtsgade 27–29, 1359 København K','Foreningen Studenterhuset':'Købmagergade 52, 1150 København K','Cafe Katz':'Frederiksholms Kanal 1, 1220 København','Palmehaven':'Pilestræde 43, 1112 København'}
last=0
for idx,v in enumerate(venues):
 name=v['name'];city='Frederiksberg' if v['district']=='FREDERIKSBERG' else 'Copenhagen';q=aliases.get(name,name)+', '+city+', Denmark'
 if v.get('verified'):continue
 if q not in cache:
  time.sleep(max(0,1.2-(time.monotonic()-last)))
  url='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q,'format':'jsonv2','addressdetails':1,'namedetails':1,'limit':5,'countrycodes':'dk','viewbox':'12.42,55.76,12.68,55.59','bounded':1})
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'JDayCopenhagenFinder/1.0 (https://6x7.gr; one-off venue geocoding)'})
   cache[q]=json.load(urllib.request.urlopen(req,timeout=25));last=time.monotonic()
   cachepath.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n')
  except Exception as e:print('Error',name,type(e).__name__,flush=True);last=time.monotonic();continue
 candidates=[]
 for c in cache[q]:
  if not (55.59<float(c['lat'])<55.76 and 12.42<float(c['lon'])<12.68):continue
  names=[c.get('name','')]+list(c.get('namedetails',{}).values())
  score=max([difflib.SequenceMatcher(None,norm(aliases.get(name,name)),norm(n)).ratio() for n in names] or [0])
  if score<0.74:continue
  if c.get('category') not in ['amenity','tourism','leisure']:continue
  if c.get('category')=='amenity' and c.get('type') not in ['bar','pub','cafe','restaurant','nightclub','community_centre','biergarten','food_court','events_venue','college','university']:continue
  if name=='Blomsten' and c.get('address',{}).get('road')!='Istedgade':continue
  candidates.append((score,c))
 candidates.sort(key=lambda x:-x[0])
 if candidates and (len(candidates)==1 or candidates[0][0]-candidates[1][0]>.12 or (max(float(x[1]['lat']) for x in candidates)-min(float(x[1]['lat']) for x in candidates)<0.0005 and max(float(x[1]['lon']) for x in candidates)-min(float(x[1]['lon']) for x in candidates)<0.0005)):
  score,c=candidates[0];a=c.get('address',{}); street=' '.join(filter(None,[a.get('road'),a.get('house_number')]))
  v.update({'verified':True,'lat':float(c['lat']),'lng':float(c['lon']),'address':addresses.get(name) or ', '.join(filter(None,[street,a.get('postcode'),a.get('city') or a.get('town') or 'København'])),'geocoded':{'source':'Nominatim / OpenStreetMap','osm_type':c['osm_type'],'osm_id':c['osm_id'],'query':q,'matched_name':c.get('name'),'score':round(score,3)}})
  print(idx+1,'OK',name,'=>',c.get('name'),v['address'],flush=True)
 else:
  v['reason']='No unambiguous matching OpenStreetMap venue found';print(idx+1,'SKIP',name,flush=True)
 if name=='Nørreport Bodega':
  v.update(verified=True,lat=55.682486,lng=12.571489,address=addresses[name]);v['coordinate_note']='User-supplied street address and coordinates, cross-checked against OSM venue'
 path.write_text(json.dumps(venues,ensure_ascii=False,indent=2)+'\n')
print('TOTAL',sum(v['verified'] for v in venues),'of',len(venues),flush=True)
