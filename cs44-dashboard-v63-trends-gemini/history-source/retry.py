"""Verify same-year direct URLs only for index-discovery failures; never substitute years."""
import sys,json,re
from pathlib import Path
from urllib.request import Request,urlopen
base=Path(__file__).resolve().parent;sys.path.insert(0,str(base/'pipeline'))
import fetch_outline
from datetime import datetime,timezone
import hashlib,time
p26=json.loads((base/'snapshots/2026.json').read_text(encoding='utf-8'))
urls={u['unit_code']:u['source_url'] for u in p26['units']}
for year in [2024,2025]:
 p=base/'snapshots'/f'{year}.json';data=json.loads(p.read_text(encoding='utf-8'));fail=[]
 for f in data['failures']:
  code=f['unit_code']; pattern=urls.get(code,''); candidates=[pattern.replace('/2026-',f'/{year}-')]
  if '-S2C-' in candidates[0]:candidates.append(candidates[0].replace('-S2C-','-S1C-'))
  elif '-S1C-' in candidates[0]:candidates.append(candidates[0].replace('-S1C-','-S2C-'))
  attempts=[];found=False
  for url in candidates:
   try:
    time.sleep(.5)
    with urlopen(Request(url,headers={'User-Agent':'CS44-OutlineResearch/1.0 (educational research)'}),timeout=20) as response:
     if response.url.rstrip('/')!=url:raise ValueError('Redirected to '+response.url)
     html=response.read().decode('utf-8')
    fetch_outline.fetch_html=lambda _:html
    u=fetch_outline.extract(url)
    if u['unit_code']!=code or str(year) not in u['session'] or not u['learning_outcomes']:raise ValueError('Identity/year/content validation failed')
    u.update(year=year,level=f['level'],available_outlines=[url],selection_rule='Direct same-year URL verified after official index did not provide a working link; tested known session pattern.',html_sha256=hashlib.sha256(html.encode()).hexdigest());u.pop('teaching_staff',None)
    data['units'].append(u);found=True;print(year,code,'RECOVERED',url,flush=True);break
   except Exception as e:attempts.append({'url':url,'error':str(e)});print(year,code,'unavailable',url,flush=True)
  if not found:f['direct_checks']=attempts;fail.append(f)
 data['failures']=fail;data['fetched_unit_count']=len(data['units']);data['failed_unit_count']=len(fail)
 p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
