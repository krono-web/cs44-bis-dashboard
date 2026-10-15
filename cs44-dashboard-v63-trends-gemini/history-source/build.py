"""Rescore all years with the recovered v6.3 taxonomy; build browser data.

The build stops unless the 2026 recomputation exactly matches the original
dashboard at record, score, phrase, rule, unit-summary and failure levels.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE / 'pipeline'))
from classify import classify
from taxonomy_config import load_taxonomy
from fetch_corpus import UG_UNITS, PG_UNITS

taxonomy = load_taxonomy(BASE / 'taxonomy_v6_3.json')
sections = {'overview': 'Overview', 'learning_outcome': 'Learning outcome', 'assessment': 'Assessment', 'assessment_description': 'Assessment detail', 'weekly_schedule': 'Weekly schedule'}
levels = {**dict.fromkeys(UG_UNITS, 'UG'), **dict.fromkeys(PG_UNITS, 'PG')}
datasets = {}
csv_rows, coverage = [], []
classified = {}
for year in [2024, 2025, 2026]:
    raw = json.loads((BASE / 'snapshots' / f'{year}.json').read_text(encoding='utf-8'))
    snapshots = {u['unit_code']: u for u in raw['units']}
    units, evidence = [], {}
    for code, level in levels.items():
        snap = snapshots.get(code)
        if not snap:
            failure = next((f.get('error', 'Unavailable') for f in raw['failures'] if f['unit_code'] == code), 'Unavailable')
            units.append(dict(code=code, title=code, level=level, status='missing', session='', categories=[], year=year, error=failure))
            coverage.append(dict(year=year, unit=code, level=level, status='missing', session='', url='', note=failure))
            continue
        assert f'/{year}-' in snap['source_url'], (year, code, 'Wrong-year outline')
        result = classify(snap, taxonomy)
        classified[year, code] = result
        cats = [dict(code=s['category_id'], positive=s['belongs_to_category'], items=s['evidence_item_count'], review=s['review_item_count'], score=s['classified_score_total'], reviewScore=s['review_score_total']) for s in result['summary']]
        units.append(dict(code=code, title=snap['unit_title'], level=level, status='selected', session=snap['session'], categories=cats, year=year, url=snap['source_url'], ruleVersion=taxonomy['version']))
        evidence[code] = {}
        for kind, rows in [('p', result['evidence']), ('r', result['review_queue'])]:
            for row in rows:
                pos = [p for m in row['matched_rules'] if not m['review_required'] for p in m['matched_phrases']]
                rev = [p for m in row['matched_rules'] if m['review_required'] for p in m['matched_phrases']]
                item = dict(k=kind, s=sections[row['section']], l=row['label'], sc=row['score'], t=row['text'], p=pos, r=rev, rules=[m['rule'] for m in row['matched_rules']])
                evidence[code].setdefault(row['category_id'], []).append(item)
                csv_rows.append(dict(year=year, unit=code, level=level, category=row['category'], status='positive' if kind == 'p' else 'review', section=item['s'], label=item['l'], text=item['t'], score=item['sc'], source_url=snap['source_url'], rule_version=taxonomy['version']))
        coverage.append(dict(year=year, unit=code, level=level, status='selected', session=snap['session'], url=snap['source_url'], note=''))
    datasets[str(year)] = dict(meta=dict(year=year, captureDate=raw['retrieved_at'], ruleVersion=taxonomy['version'], harmonized=True, ruleCount=sum(len(c['rules']) for c in taxonomy['categories']), sourceCommit='a3475d9cce9b54d48329daadbf974e9f174cbc28'), categories=[dict(code=c['id'], name=c['name'], definition=c['definition']) for c in taxonomy['categories']], units=units, evidence=evidence, failures=raw['failures'])
    print(year, 'analysed', len(snapshots), 'positive', sum(c['items'] for u in units for c in u['categories']), 'review', sum(c['review'] for u in units for c in u['categories']))

# Exact reproduction gate: no historical output is published unless the recovered
# rules reproduce every original 2026 record and unit-category summary.
original_text = (BASE.parent / 'dashboard' / 'data.js').read_text(encoding='utf-8').strip()
original = json.loads(original_text[original_text.index('{'):].rstrip(';'))
reverse_sections = {value: key for key, value in sections.items()}
for unit in original['units']:
    if unit['status'] != 'selected':
        continue
    result = classified[2026, unit['code']]
    got_summary = {row['category_id']: row for row in result['summary']}
    for expected in unit['categories']:
        actual = got_summary[expected['code']]
        check = {
            'positive': actual['belongs_to_category'],
            'items': actual['evidence_item_count'],
            'review': actual['review_item_count'],
            'score': actual['classified_score_total'],
            'reviewScore': actual['review_score_total'],
        }
        wanted = {key: expected[key] for key in check}
        if check != wanted:
            raise ValueError(f"2026 summary mismatch {unit['code']} {expected['code']}: {check} != {wanted}")
    got_rows = set()
    for kind, rows in [('p', result['evidence']), ('r', result['review_queue'])]:
        for row in rows:
            positives = tuple(sorted({phrase for match in row['matched_rules'] if not match['review_required'] for phrase in match['matched_phrases']}))
            reviews = tuple(sorted({phrase for match in row['matched_rules'] if match['review_required'] for phrase in match['matched_phrases']}))
            got_rows.add((row['category_id'], kind, row['section'], row['label'], row['text'], row['score'], positives, reviews, tuple(sorted(match['rule'] for match in row['matched_rules']))))
    wanted_rows = set()
    for category, rows in original['evidence'].get(unit['code'], {}).items():
        for row in rows:
            wanted_rows.add((category, row['k'], reverse_sections[row['s']], row['l'], row['t'], row['sc'], tuple(sorted(row.get('p', []))), tuple(sorted(row.get('r', []))), tuple(sorted(row['rules']))))
    if got_rows != wanted_rows:
        raise ValueError(f"2026 evidence mismatch for {unit['code']}: missing={wanted_rows-got_rows}, extra={got_rows-wanted_rows}")
if sorted(f['course_code'] for f in original['failures']) != sorted(f['unit_code'] for f in datasets['2026']['failures']):
    raise ValueError('2026 failure register does not match the original dashboard')
print('2026 exact reproduction gate: PASS')

common = sorted(set.intersection(*[{u['code'] for u in d['units'] if u['status'] == 'selected'} for d in datasets.values()]))
payload = dict(years=datasets, commonUnits=common, taxonomyVersion=taxonomy['version'], taxonomySha256=hashlib.sha256((BASE/'taxonomy_v6_3.json').read_bytes()).hexdigest(), ruleCount=sum(len(c['rules']) for c in taxonomy['categories']))
dest = BASE.parent / 'dashboard'
(dest / 'history-data.js').write_text('window.CS44_HISTORY = ' + json.dumps(payload, ensure_ascii=False) + ';\n', encoding='utf-8')
for filename, rows in [('historical-evidence.csv', csv_rows), ('historical-coverage.csv', coverage)]:
    with (BASE / filename).open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
print('Common units:', len(common), ', '.join(common))
