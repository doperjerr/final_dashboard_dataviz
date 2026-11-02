"""Reproducible, standard-library-only preparation. Never changes dataset/ inputs."""
from pathlib import Path
import csv
import json
import hashlib
import datetime as dt
import collections
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'dataset'
OUT = ROOT / 'data' / 'processed'
WEB = ROOT / 'prototype'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
CATEGORY = {
    'Government policy & news': ('gov_policy', 'นโยบายรัฐและข่าวสาร'),
    'Health products': ('health', 'ผลิตภัณฑ์สุขภาพ'),
    'Finance & stocks': ('finance', 'การเงินและหุ้น'),
    'Disasters': ('disaster', 'ภัยพิบัติ'),
    'Public order & security': ('security', 'ความสงบและความมั่นคง'),
}
issues = []


def read_csv(name):
    with (RAW / name).open(encoding='utf-8-sig', newline='') as f:
        return [{k: v.strip() for k, v in r.items()} for r in csv.DictReader(f)]


def number(value):
    return float(value) if value not in ('', None) else None


def date(value):
    return dt.date.fromisoformat(value[:10])


def sunday(value):
    d = date(value)
    return (d - dt.timedelta(days=(d.weekday() + 1) % 7)).isoformat()


def unique(rows, key, source):
    seen = {}
    for row in rows:
        ident = row[key]
        if not ident:
            raise ValueError(f'{source}: missing {key}')
        if ident in seen:
            if seen[ident] != row:
                raise ValueError(f'{source}: conflicting duplicate {ident}')
            issues.append({'source': source, 'key': ident, 'action': 'removed exact duplicate'})
        else:
            seen[ident] = row
    return list(seen.values())


def write_csv(name, rows):
    if not rows:
        return
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def xlsx_incidents(path):
    # Resolve sheet by its name instead of assuming a particular sheet order.
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(s.itertext()) for s in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        rels = {x.attrib['Id']: x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS)
        sheet = next(s for s in sheets if s.attrib['name'] == 'Incidents')
        target = rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows = []
        for row in ET.fromstring(z.read(target)).findall('m:sheetData/m:row', NS):
            vals = {}
            for c in row:
                col = ''.join(t for t in c.attrib['r'] if t.isalpha())
                v, inline = c.find('m:v', NS), c.find('m:is', NS)
                vals[col] = (strings[int(v.text)] if c.attrib.get('t') == 's' and v is not None
                             else ''.join(inline.itertext()) if inline is not None
                             else v.text if v is not None else '')
            rows.append(vals)
    headers = rows[2]
    wanted = ['Incident ID', 'date', 'year', 'title', 'description', 'Implicated Systems',
              'Risk Domain', 'Risk Subdomain', 'Intent', 'report_count', 'Country Code']
    result = []
    for raw in rows[3:]:
        row = {label: raw.get(col, '').strip() for col, label in headers.items() if label in wanted}
        if not row.get('Incident ID'):
            continue
        # Excel's standard 1900 date system; date column in this export is numeric.
        raw_date = row['date']
        try:
            actual_date = (dt.date(1899, 12, 30) + dt.timedelta(days=float(raw_date))).isoformat()
        except ValueError:
            actual_date = date(raw_date).isoformat()
        row['date'] = actual_date
        row['year'] = date(actual_date).year
        row['report_count'] = number(row['report_count'])
        assert row['report_count'] is None or row['report_count'] >= 0
        result.append(row)
    return unique(result, 'Incident ID', path.name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    original = unique(read_csv('weekly_panel.csv'), 'week_start', 'weekly_panel')
    afnc = unique(read_csv('afnc_items.csv'), 'post_id', 'AFNC')
    acsc = unique(read_csv('acsc_weekly.csv'), 'week_start', 'ACSC')
    latest = sorted(RAW.glob('AIID_Excel_Export-*.xlsx'))[-1]
    ai = xlsx_incidents(latest)
    counts = collections.defaultdict(collections.Counter)
    cats = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    news = []
    for row in afnc:
        week = sunday(row['date'])
        if row['week_start'] != week:
            issues.append({'source': 'AFNC', 'key': row['post_id'], 'action': 'recomputed week_start from publication date'})
        row['week_start'] = week
        row['year'] = str(date(row['date']).year)
        row['month'] = row['date'][:7]
        if row['item_type'] == 'Verdict':
            verdict = row['verdict_en']
            assert verdict in ('Fake', 'Distorted', 'True'), row['post_id']
            counts[week]['afnc_verdicts'] += 1
            counts[week]['afnc_' + verdict.lower()] += 1
            category, label = CATEGORY.get(row['category_en'], ('other', 'หมวดอื่น ๆ'))
            cats[week][row['category_en']][verdict] += 1
            if verdict != 'True':
                counts[week]['afnc_false_' + category] += 1
            news.append({k: row[k] for k in ('post_id', 'date', 'week_start', 'title', 'verdict_en', 'category_en', 'url')})
        elif row['item_type'] == 'Online crime advisory':
            counts[week]['afnc_online_crime_advisories'] += 1
    acsc_by_week = {}
    for row in acsc:
        row['source_week_start'] = row['week_start']
        # Analysis bucket follows Sunday–Saturday. Preserve the originally stated
        # eight-day interval and exclude it by default instead of silently fixing it.
        week = (date(row['week_end']) - dt.timedelta(days=6)).isoformat()
        assert date(week).weekday() == 6
        row['analysis_week_start'] = week
        row['quality'] = ('suspect_total' if row['flag'].startswith('Suspect:') else
                          'overlapping_period' if int(row['days']) != 7 else
                          'caution' if row['flag'] else 'standard')
        row['exclude_default'] = row['quality'] in ('suspect_total', 'overlapping_period')
        for k in ('cases', 'loss_baht', 'loss_per_case_baht', 'top_type_case_share_pct', 'highest_loss_type_loss_baht',
                  'cases_change_vs_prev_week', 'loss_change_vs_prev_week_baht'):
            row[k] = number(row[k])
        assert row['cases'] > 0 and row['loss_baht'] >= 0
        row['loss_per_case_calculated'] = row['loss_baht'] / row['cases']
        assert week not in acsc_by_week
        acsc_by_week[week] = row
        if row['source_week_start'] != week:
            issues.append({'source': 'ACSC', 'key': row['source_week_start'], 'action': f'analysis bucket {week}; raw dates preserved; excluded by default'})
    weekly = []
    diffs = []
    for old in sorted(original, key=lambda r: r['week_start']):
        week = old['week_start']
        assert sunday(week) == week
        assert (date(old['week_end']) - date(week)).days == 6
        c = counts[week]
        row = {'week_start': week, 'week_end': old['week_end'], 'year': date(week).year, 'month': week[:7]}
        for k in ['afnc_verdicts', 'afnc_fake', 'afnc_distorted', 'afnc_true',
                  *['afnc_false_' + t for t in ['gov_policy', 'health', 'finance', 'disaster', 'security', 'other']],
                  'afnc_online_crime_advisories']:
            row[k] = c[k]
            if number(old[k]) != row[k]:
                diffs.append({'week_start': week, 'column': k, 'original': old[k], 'rebuilt': row[k]})
        row['afnc_false_share_pct'] = 100 * (c['afnc_fake'] + c['afnc_distorted']) / c['afnc_verdicts'] if c['afnc_verdicts'] else None
        a = acsc_by_week.get(week)
        row['acsc_reported'] = a is not None
        for field in ['cases', 'loss_baht', 'loss_precision', 'top_type_th', 'highest_loss_type_th', 'flag', 'source_url']:
            row['acsc_' + field] = a[field] if a else None
        row['acsc_loss_per_case_baht'] = a['loss_per_case_calculated'] if a else None
        row['quality'] = a['quality'] if a else 'missing'
        row['exclude_default'] = a['exclude_default'] if a else False
        row['acsc_source_week_start'] = a['source_week_start'] if a else None
        row['acsc_days'] = int(a['days']) if a else None
        if a:
            for k in ('acsc_cases', 'acsc_loss_baht'):
                assert number(old[k]) == row[k], (week, k, old[k], row[k])
        else:
            assert not old['acsc_cases'] and not old['acsc_loss_baht'], week
        assert row['afnc_verdicts'] == sum(row['afnc_' + t] for t in ['fake', 'distorted', 'true'])
        assert sum(row['afnc_false_' + t] for t in ['gov_policy', 'health', 'finance', 'disaster', 'security', 'other']) == row['afnc_fake'] + row['afnc_distorted']
        weekly.append(row)
    assert set(counts) <= {r['week_start'] for r in weekly}
    assert set(acsc_by_week) <= {r['week_start'] for r in weekly}
    for prev, current in zip(weekly, weekly[1:]):
        assert (date(current['week_start']) - date(prev['week_start'])).days == 7
    categories = [dict(week_start=w, category=k, fake=v['Fake'], distorted=v['Distorted'], true=v['True'])
                  for w, group in sorted(cats.items()) for k, v in sorted(group.items())]
    assert sum(r['afnc_verdicts'] for r in weekly) == len(news)
    assert sum(r['afnc_verdicts'] for r in weekly) == sum(r['fake'] + r['distorted'] + r['true'] for r in categories)
    report = {
        'generated_on': dt.date.today().isoformat(),
        'inputs': [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [RAW/'weekly_panel.csv', RAW/'afnc_items.csv', RAW/'acsc_weekly.csv', latest]],
        'counts': {'weekly_rows': len(weekly), 'afnc_posts': len(afnc), 'afnc_verdicts': len(news), 'acsc_reported_weeks': len(acsc),
                   'acsc_default_included': sum(not r['exclude_default'] for r in acsc),
                   'ai_incidents': len(ai), 'ai_classified': sum(bool(r['Risk Domain']) for r in ai)},
        'panel_reconciliation_differences': len(diffs), 'issues': issues,
        'rules': [
            'Raw files are unchanged; exact duplicate keys removed only if all fields match; conflicting duplicates fail.',
            'weekly_panel is the weekly spine; AFNC is rebuilt from publication dates and reconciled to the supplied panel.',
            'Missing scam statistics stay null; AFNC empty weeks are zero publication counts, not evidence of zero misinformation.',
            '2026-08-16 suspect totals and 2026-05-31 eight-day overlapping interval are excluded from scam metrics by default, never deleted.',
            'Other caution rows remain included; all flags and original reporting intervals are retained.',
            'Ratios are recomputed from sums. Months follow week_start; they are reporting buckets, not exact calendar-month event counts.',
            'AIID uses the newest snapshot actually available in the project; no snapshots are concatenated.',
            'AIID is contextual only: no invented join between foreign AI incidents and Thai scam cases.',
            'Scam type names are preserved; no automatic merging of ambiguous category labels.',
        ],
    }
    write_csv('weekly_panel_clean.csv', weekly)
    # Selected analytical columns keep this export compact; full source text remains in dataset/.
    write_csv('afnc_verdicts_clean.csv', news)
    write_csv('afnc_category_weekly.csv', categories)
    write_csv('acsc_weekly_clean.csv', acsc)
    write_csv('ai_incidents_clean.csv', ai)
    write_csv('panel_reconciliation.csv', diffs or [{'week_start': '', 'column': 'ALL_COUNT_COLUMNS_MATCH', 'original': '', 'rebuilt': ''}])
    (OUT / 'quality_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    payload = {'weekly': weekly, 'categories': categories, 'ai': ai, 'report': report, 'ai_snapshot': latest.stem.removeprefix('AIID_Excel_Export-')}
    (WEB / 'data.js').write_text('window.DASHBOARD_DATA=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + ';\n', encoding='utf-8')
    (WEB / 'news.js').write_text('window.NEWS_DATA=' + json.dumps(news, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
