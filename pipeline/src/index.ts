import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CityIndexEntry, CityMeta, DataIndex, LocalityRecord, SearchEntry } from '@locus/shared';
import { CITIES_DIR, DATA_DIR, REPO_ROOT } from './config.js';

/**
 * npm run index -w pipeline [--sync]
 *   data/index.json  - built cities + a flat search list of every locality
 *   --sync           - copy data/index.json and data/cities/<id>/*.json into client/public/data/
 */

export function buildIndex(): DataIndex {
  const cities: CityIndexEntry[] = [];
  const search: SearchEntry[] = [];
  for (const id of readdirSync(CITIES_DIR)) {
    const metaFile = path.join(CITIES_DIR, id, 'meta.json');
    if (!existsSync(metaFile)) continue;
    const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as CityMeta;
    const localities = JSON.parse(readFileSync(path.join(CITIES_DIR, id, 'localities.json'), 'utf8')) as LocalityRecord[];
    cities.push({ id: meta.id, name: meta.name, state: meta.state, center: meta.center, bbox: meta.bbox, localities: localities.length });
    search.push({ k: 'c', name: meta.name, city: meta.id, lat: meta.center.lat, lng: meta.center.lng, w: 1_000_000 });
    for (const l of localities) {
      search.push({ k: 'l', name: l.name, city: meta.id, lat: l.center.lat, lng: l.center.lng, id: l.id, w: (l.support ?? 0) * 3 + l.density + (l.tier === 'primary' ? 1000 : 0) });
    }
  }
  cities.sort((a, b) => a.name.localeCompare(b.name));
  return { builtAt: new Date().toISOString(), cities, search };
}

export function syncToClient(): void {
  const dest = path.join(REPO_ROOT, 'client', 'public', 'data');
  mkdirSync(path.join(dest, 'cities'), { recursive: true });
  cpSync(path.join(DATA_DIR, 'index.json'), path.join(dest, 'index.json'));
  for (const id of readdirSync(CITIES_DIR)) {
    const src = path.join(CITIES_DIR, id);
    if (!existsSync(path.join(src, 'meta.json'))) continue;
    mkdirSync(path.join(dest, 'cities', id), { recursive: true });
    for (const f of ['meta.json', 'localities.json', 'pois.json']) cpSync(path.join(src, f), path.join(dest, 'cities', id, f));
  }
}

if (process.argv[1] && /index\.(ts|js)$/.test(process.argv[1])) {
  const idx = buildIndex();
  writeFileSync(path.join(DATA_DIR, 'index.json'), JSON.stringify(idx));
  console.log(`index: ${idx.cities.length} cities, ${idx.search.length} search entries`);
  if (process.argv.includes('--sync')) {
    syncToClient();
    console.log('synced to client/public/data');
  }
}
