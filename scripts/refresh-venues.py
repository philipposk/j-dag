"""Refresh the source roster, preserving coordinates only for unchanged names.
Discovery is deliberately human/assistant-reviewed: see README before --apply.
"""
import argparse,datetime,html,json,pathlib,re,urllib.request,urllib.parse
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--year',type=int,required=True)
p.add_argument('--source-url',default='https://migogkbh.dk/oel-og-nisser-paa-j-dag-i-koebenhavn/')
p.add_argument('--apply',action='store_true',help='Save roster and changelog after reviewing the diff')
a=p.parse_args();root=pathlib.Path(__file__).resolve().parents[1]
print('Before applying, search the web for newer articles:')
for q in [f'J-dag København {a.year}',f'Her kan du fejre J-dag {a.year} Mig og KBH']:
 print('https://www.google.com/search?'+urllib.parse.urlencode({'q':q}))
if not a.source_url.startswith('https://migogkbh.dk/'):
 p.error('Review a new publisher/parser before using a non-Mig-og-KBH source')
s=urllib.request.urlopen(urllib.request.Request(a.source_url,headers={'User-Agent':'JDayCopenhagenFinder/1.0 (https://6x7.gr)'}),timeout=30).read().decode()
# Require the selected year in the article title, never silently re-label stale data.
title=' '.join(re.findall('<title[^>]*>(.*?)</title>',s,re.S))
if str(a.year) not in title:p.error(f'Article title does not confirm {a.year}: {html.unescape(title)}')
start=s.find('KØBENHAVN K:')
if start<0:p.error('District headings changed; review parser before replacing data')
# Restrict to the article, not related stories or site navigation.
end=s.find('</article>',start)
section=s[start:end if end>=0 else len(s)]
old=json.loads((root/'data/venues.json').read_text());index={v['name'].casefold():v for v in old}
rows=[];district='KØBENHAVN K';seen=set()
for tag,text in re.findall(r'<(p|h[2-4]|li)\b[^>]*>(.*?)</\1>',section,re.S):
 text=html.unescape(re.sub('<[^>]+>','',text)).strip()
 if text.rstrip(':') in ['KØBENHAVN K','KØBENHAVN V','KØBENHAVN N + NV','KØBENHAVN S + SV','KØBENHAVN Ø','FREDERIKSBERG','VALBY + VANLØSE']:
  district=text.rstrip(':')
 elif tag=='li' and text and text not in seen:
  seen.add(text);existing=index.get(text.casefold())
  rows.append({**existing,'name':text,'district':district} if existing else {'name':text,'district':district,'verified':False,'reason':'New venue: geocoding required'})
if not 80<=len(rows)<=300:p.error(f'Unexpected venue count {len(rows)}; review parser')
new_names={v['name'] for v in rows};old_names={v['name'] for v in old}
added=sorted(new_names-old_names);removed=sorted(old_names-new_names)
print(json.dumps({'year':a.year,'source':a.source_url,'total':len(rows),'added':added,'removed':removed},ensure_ascii=False,indent=2))
if not a.apply:
 print('Dry run only. Review source freshness and diff, then rerun with --apply.');raise SystemExit()
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
archive=root/'data/history';archive.mkdir(exist_ok=True)
meta=json.loads((root/'data/metadata.json').read_text())
(archive/f"venues-{meta['year']}-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.json").write_text(json.dumps({'metadata':meta,'venues':old},ensure_ascii=False,indent=2)+'\n')
(root/'data/venues.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
meta.update(year=a.year,sourceUrl=a.source_url,fetchedAt=now)
(root/'data/metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
with (root/'data/CHANGELOG.md').open('a') as f:
 f.write(f"\n## {now} — {a.year}\nSource: {a.source_url}\nAdded: {', '.join(added) or 'none'}\nRemoved: {', '.join(removed) or 'none'}\nTotal: {len(rows)}. Run geocoding and review before deploy.\n")
print('Saved. Next: npm run geocode, inspect uncertain matches, npm test && npm run build.')
