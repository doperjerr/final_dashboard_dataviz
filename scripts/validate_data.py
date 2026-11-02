"""Independent reconciliation of prepared outputs against untouched sources."""
import collections
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'processed'


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def main():
    report = json.loads((OUT / 'quality_report.json').read_text(encoding='utf-8'))
    for source in report['inputs']:
        assert hashlib.sha256((ROOT / 'dataset' / source['file']).read_bytes()).hexdigest() == source['sha256'], source['file']
    weekly = read(OUT / 'weekly_panel_clean.csv')
    afnc = read(ROOT / 'dataset' / 'afnc_items.csv')
    acsc = read(ROOT / 'dataset' / 'acsc_weekly.csv')
    categories = read(OUT / 'afnc_category_weekly.csv')
    assert len({r['week_start'] for r in weekly}) == len(weekly)
    assert len({(r['week_start'], r['category']) for r in categories}) == len(categories)
    expected = collections.Counter()
    for r in afnc:
        if r['item_type'] == 'Verdict':
            d = dt.date.fromisoformat(r['date'])
            week = (d-dt.timedelta(days=(d.weekday()+1) % 7)).isoformat()
            expected[(week, r['verdict_en'])] += 1
    for row in weekly:
        for verdict in ('Fake', 'Distorted', 'True'):
            assert int(row['afnc_'+verdict.lower()]) == expected[(row['week_start'], verdict)]
        total = int(row['afnc_verdicts'])
        ratio = row['afnc_false_share_pct']
        if total:
            assert abs(float(ratio)-100*(int(row['afnc_fake'])+int(row['afnc_distorted']))/total) < 1e-9
        else:
            assert ratio == ''
    by_week = {r['week_start']: r for r in weekly}
    for raw in acsc:
        week = (dt.date.fromisoformat(raw['week_end'])-dt.timedelta(days=6)).isoformat()
        clean = by_week[week]
        assert float(clean['acsc_cases']) == float(raw['cases'])
        assert float(clean['acsc_loss_baht']) == float(raw['loss_baht'])
        assert abs(float(clean['acsc_loss_per_case_baht'])-float(raw['loss_baht'])/float(raw['cases'])) < 1e-8
        assert clean['acsc_source_week_start'] == raw['week_start']
    for missing in ('2026-06-14', '2026-07-26', '2026-10-25'):
        assert by_week[missing]['acsc_cases'] == ''
        assert by_week[missing]['acsc_reported'] == 'False'
    assert {r['week_start'] for r in weekly if r['exclude_default'] == 'True'} == {'2026-05-31', '2026-08-16'}
    assert by_week['2026-08-23']['exclude_default'] == 'False'
    assert by_week['2026-04-12']['exclude_default'] == 'False'
    assert sum(int(r['fake'])+int(r['distorted'])+int(r['true']) for r in categories) == sum(expected.values())
    ai = read(OUT / 'ai_incidents_clean.csv')
    assert len(ai) == len({r['Incident ID'] for r in ai})
    assert len(ai) == report['counts']['ai_incidents']
    assert sum(bool(r['Risk Domain']) for r in ai) == report['counts']['ai_classified']
    print('PASS: source hashes; AFNC weekly counts and ratios; unique join keys; ACSC totals and intervals; missing values; quality exclusions; category totals; AI snapshot keys and coverage.')


if __name__ == '__main__':
    main()
