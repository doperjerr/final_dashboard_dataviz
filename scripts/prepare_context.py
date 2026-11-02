"""Prepare country/year and debunk context without inventing incident-level joins."""
import collections
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'processed'


def read(name):
    with (ROOT / 'dataset' / name).open(encoding='utf-8-sig', newline='') as f:
        return [{k: v.strip() for k, v in r.items()} for r in csv.DictReader(f)]


def write(name, rows):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)


def main():
    freedom = read('freedom_on_the_net_scores.csv')
    keys = set()
    for r in freedom:
        for k in ['data_year', 'report_edition', 'total_score', 'obstacles_to_access', 'limits_on_content', 'violations_of_user_rights']:
            r[k] = int(r[k]) if r[k] else None
        assert (r['iso3'], r['data_year']) not in keys
        keys.add((r['iso3'], r['data_year']))
        assert r['report_edition'] == r['data_year'] + 1
        assert 0 <= r['total_score'] <= 100
        assert r['total_score'] == sum(r[k] for k in ['obstacles_to_access', 'limits_on_content', 'violations_of_user_rights'])
    eu = read('euvsdisinfo_base.csv')
    debunks = {}
    languages = collections.defaultdict(set)
    for r in eu:
        d = dt.datetime.strptime(r['debunk_date'], '%d-%m-%Y').date().isoformat()
        key = r['debunk_id']
        if key in debunks:
            assert debunks[key]['date'] == d
        else:
            debunks[key] = {'debunk_id': key, 'date': d, 'keywords': r['keywords']}
        languages[(d[:4], r['article_language'], r['class'])].add(r['article_id'])
    eu_month = collections.Counter(r['date'][:7] for r in debunks.values())
    geo = json.loads((ROOT / 'prototype' / 'world.geojson').read_text(encoding='utf-8'))
    # Compact boundaries for offline SVG rendering; never infer countries from language.
    shapes = []
    for f in geo['features']:
        p = f['properties']
        iso = p.get('ISO_A3_EH') or p.get('ISO_A3')
        if iso == '-99': iso = p.get('ADM0_A3')
        shapes.append({'iso3': iso, 'name': p['NAME'], 'geometry': f['geometry']})
    iso2_to_iso3 = {}
    for f in geo['features']:
        p = f['properties']
        iso2 = p.get('ISO_A2_EH') or p.get('ISO_A2')
        iso3 = p.get('ISO_A3_EH') or p.get('ISO_A3')
        if iso2 and iso2 != '-99' and iso3 and iso3 != '-99':
            iso2_to_iso3[iso2] = iso3
    lookup = {(r['iso3'], r['data_year']): r for r in freedom}
    with (OUT/'ai_incidents_clean.csv').open(encoding='utf-8-sig', newline='') as f:
        ai = list(csv.DictReader(f))
    joined = []
    for row in ai:
        iso = iso2_to_iso3.get(row['Country Code'])
        score = lookup.get((iso, int(row['year'])))
        joined.append({'incident_id': row['Incident ID'], 'year': row['year'], 'country_code': row['Country Code'],
                       'iso3': iso, 'freedom_score': score['total_score'] if score else None,
                       'freedom_data_year': score['data_year'] if score else None,
                       'join_status': 'matched' if score else 'missing_country' if not row['Country Code']
                                      else 'outside_freedom_years' if not 2010 <= int(row['year']) <= 2024
                                      else 'no_country_year_score'})
    assert len(joined) == len(ai) == len({r['incident_id'] for r in joined})
    write('ai_country_year_context.csv', joined)
    payload = {'freedom': freedom, 'world': shapes,
               'iso2_to_iso3': iso2_to_iso3,
               'eu_debunks': sorted(debunks.values(), key=lambda r: (r['date'], r['debunk_id'])),
               'eu_month': [{'month': k, 'count': v} for k,v in sorted(eu_month.items())],
               'eu_languages': [{'year': int(y), 'language': lang, 'class': cls, 'articles': len(ids)} for (y,lang,cls),ids in sorted(languages.items())],
               'eu_meta': {'rows': len(eu), 'debunks': len(debunks), 'start': min(r['date'] for r in debunks.values()), 'end': max(r['date'] for r in debunks.values())},
               'ai_join_coverage': dict(collections.Counter(r['join_status'] for r in joined)),
               'sources': [{'file': n, 'sha256': hashlib.sha256((ROOT/'dataset'/n).read_bytes()).hexdigest()} for n in ['freedom_on_the_net_scores.csv','euvsdisinfo_base.csv']]}
    write('freedom_country_year_clean.csv', freedom)
    write('eu_debunks_clean.csv', list(debunks.values()))
    (ROOT/'prototype'/'context.js').write_text('window.CONTEXT_DATA='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    print(json.dumps({'freedom_rows':len(freedom),'countries':len({r['iso3'] for r in freedom}),'eu_debunks':len(debunks),'eu_dates':payload['eu_meta']},ensure_ascii=False))


if __name__ == '__main__': main()
