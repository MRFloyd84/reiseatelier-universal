#!/usr/bin/env python3
"""Baut die Offline-Kartenpakete für Reiseatelier (läuft in der GitHub Action „Seite und Kartenpakete“).

Liest maps/packs.json, sucht den neuesten Protomaps-Planet-Build (build.protomaps.com, wöchentliche Montags-Builds
werden einen Monat lang aufbewahrt), schneidet mit dem pmtiles-Programm jede Stadt aus und schreibt die Pakete samt
maps/catalog.json in den Zielordner. Schon gebaute Pakete im Cache-Ordner werden wiederverwendet.

Aufruf:  python3 tools/build_map_packs.py <pmtiles-Programm> <Cache-Ordner> <Zielordner>
Kartendaten © OpenStreetMap-Mitwirkende (ODbL), aufbereitet von Protomaps."""
import datetime, json, pathlib, shutil, subprocess, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
pmtiles, cache, out = sys.argv[1], pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3])
cache.mkdir(parents=True, exist_ok=True); out.mkdir(parents=True, exist_ok=True)
cfg = json.loads((ROOT / 'maps' / 'packs.json').read_text(encoding='utf-8'))
maxzoom = int(cfg.get('maxzoom', 15))

def exists(url):
    try:
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Reiseatelier-Kartenpakete'})
        with urllib.request.urlopen(req, timeout=30) as r: return r.status == 200
    except Exception: return False

build = None
today = datetime.date.today()
for back in range(0, 45):
    d = today - datetime.timedelta(days=back)
    if exists(f'https://build.protomaps.com/{d:%Y%m%d}.pmtiles'):
        build = f'{d:%Y%m%d}'; break
if not build:
    print('::warning::Kein Protomaps-Build gefunden – Kartenpakete werden diesmal nicht gebaut.')
    sys.exit(0)
src = f'https://build.protomaps.com/{build}.pmtiles'
date = f'{build[:4]}-{build[4:6]}-{build[6:]}'
print('Protomaps-Build:', src)

catalog = {'build': build, 'generated': today.isoformat(), 'attribution': 'Protomaps © OpenStreetMap', 'packs': []}
for p in cfg['packs']:
    pid = p['id']; target = cache / f'{pid}-{build}-z{maxzoom}.pmtiles'
    bbox = ','.join(str(x) for x in p['bbox'])
    if not target.exists():
        for old in cache.glob(f'{pid}-*.pmtiles'): old.unlink()
        print(f'→ {p["name"]}: schneide {bbox} (bis Zoom {maxzoom}) …', flush=True)
        r = subprocess.run([pmtiles, 'extract', src, str(target), f'--bbox={bbox}', f'--maxzoom={maxzoom}'])
        if r.returncode != 0 or not target.exists():
            print(f'::warning::{p["name"]} konnte nicht gebaut werden.'); target.unlink(missing_ok=True); continue
    else:
        print(f'→ {p["name"]}: aus dem Cache')
    file = f'{pid}.pmtiles'; shutil.copyfile(target, out / file)
    size = (out / file).stat().st_size
    print(f'   {size/1048576:.1f} MB')
    catalog['packs'].append({'id': pid, 'name': p['name'], 'name_en': p.get('name_en', ''), 'country': p.get('country', ''),
                             'bbox': p['bbox'], 'file': file, 'size': size, 'date': date, 'maxzoom': maxzoom})
(out / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding='utf-8')
total = sum(x['size'] for x in catalog['packs'])
print(f'{len(catalog["packs"])} Kartenpakete, zusammen {total/1048576:.0f} MB')
if total > 900 * 1048576: print('::warning::Die Kartenpakete sind zusammen fast 1 GB groß – GitHub Pages erlaubt höchstens 1 GB.')
