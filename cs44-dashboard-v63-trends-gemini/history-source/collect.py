"""Collect published 2024/2025 outlines using the upstream parser; retain failures.
Run from the delivery root: python history-source/collect.py --cache work/history-cache
Dependencies: pandas, lxml. Upstream commit: a3475d9.
"""
import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
import lxml.html

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / 'pipeline'))
import fetch_outline
from fetch_corpus import UG_UNITS, PG_UNITS

parser = argparse.ArgumentParser()
parser.add_argument('--cache', type=Path, default=BASE / 'cache')
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)

def fetch(url):
    name = hashlib.sha256(url.encode()).hexdigest() + '.html'
    file = args.cache / name
    if file.exists():
        return file.read_text(encoding='utf-8')
    time.sleep(0.4)
    req = Request(url, headers={'User-Agent': 'CS44-OutlineResearch/1.0 (educational research; public outlines)'})
    with urlopen(req, timeout=25) as response:
        if response.url.rstrip('/') != url.rstrip('/'):
            raise ValueError('Unexpected redirect: ' + response.url)
        html = response.read().decode('utf-8')
    file.write_text(html, encoding='utf-8')
    return html

fetch_outline.fetch_html = fetch
levels = {**dict.fromkeys(UG_UNITS, 'UG'), **dict.fromkeys(PG_UNITS, 'PG')}
for year in [2024, 2025]:
    target = BASE / 'snapshots' / f'{year}.json'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
    saved = {u['unit_code']: u for u in previous.get('units', [])}
    units, failures = [], []
    for code, level in levels.items():
        if code in saved:
            units.append(saved[code]); continue
        try:
            base = f'https://www.sydney.edu.au/units/{code}'
            page = lxml.html.fromstring(fetch(base))
            prefix = f'/units/{code}/{year}-'
            urls = sorted({urljoin(base, href) for href in page.xpath('//a/@href') if href.startswith(prefix)})
            if not urls:
                raise ValueError(f'No published {year} outline linked from the official unit page')
            pool = [u for u in urls if f'/{year}-S2' in u] or [u for u in urls if f'/{year}-S1' in u] or urls
            url = pool[0]
            raw = fetch(url)
            unit = fetch_outline.extract(url)
            if unit['unit_code'] != code or not unit['items'] or not unit['learning_outcomes']:
                raise ValueError('Outline identity or required content validation failed')
            if str(year) not in unit['session']:
                raise ValueError('Outline heading does not confirm the requested year: ' + unit['session'])
            unit.update(level=level, year=year, available_outlines=urls,
                selection_rule='Prefer Semester 2; otherwise Semester 1; otherwise first published outline within the requested year.',
                html_sha256=hashlib.sha256(raw.encode()).hexdigest())
            # Staff names are not needed for this evidence analysis.
            unit.pop('teaching_staff', None)
            units.append(unit)
            print(f'{year} {code}: {len(unit["items"])} outline items | {unit["session"]}', flush=True)
        except Exception as e:
            failures.append({'unit_code': code, 'level': level, 'error': str(e)})
            print(f'{year} {code}: UNAVAILABLE | {e}', flush=True)
        payload = dict(corpus=f'CS-44 {year} BIS public outlines', retrieved_at=datetime.now(timezone.utc).isoformat(),
            requested_unit_count=len(levels), fetched_unit_count=len(units), failed_unit_count=len(failures), units=units, failures=failures,
            selection_rule='Semester 2 preferred, then Semester 1, then first published session; no cross-year substitution.')
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{year}: {len(units)}/{len(levels)} collected', flush=True)
