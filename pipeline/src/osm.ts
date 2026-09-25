import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { cityBbox, cityById, cityDir, OSM_DIR, type Bbox, type CityConfig } from './config.js';
import { anyKeySql, keysListSql, osmKeyColumnsSql } from './classify.js';
import { openDuck, q, type Duck } from './duck.js';

/**
 * OSM layer for one city, read straight from a Geofabrik .osm.pbf with DuckDB spatial:
 *   raw/osm_places.parquet  place=suburb|town|neighbourhood|quarter nodes and area centroids
 *   raw/osm_pois.parquet    elements matching the taxonomy's OSM tag filters (transit, parks, worship...)
 * Ways get a centroid from their member nodes; relations are skipped (rare for what we need).
 */

const PLACE_VALUES = ['suburb', 'town', 'neighbourhood', 'quarter', 'village'];

export function pbfFor(): string {
  const env = process.env.OSM_PBF;
  if (env) return env;
  for (const f of ['india-latest.osm.pbf', 'western-zone-latest.osm.pbf']) {
    const p = path.join(OSM_DIR, f);
    if (existsSync(p)) return p;
  }
  throw new Error(`No .osm.pbf in ${OSM_DIR}; set OSM_PBF or download one from Geofabrik`);
}

export async function extractOsm(duck: Duck, city: CityConfig, pbf: string, force = false): Promise<{ places: string; pois: string }> {
  const raw = path.join(cityDir(city), 'raw');
  mkdirSync(raw, { recursive: true });
  const out = { places: path.join(raw, 'osm_places.parquet'), pois: path.join(raw, 'osm_pois.parquet') };
  if (!force && existsSync(out.places) && existsSync(out.pois)) {
    console.log('  osm: cached');
    return out;
  }
  const b: Bbox = cityBbox(city);
  const t = Date.now();
  const inBbox = `lon BETWEEN ${b.west} AND ${b.east} AND lat BETWEEN ${b.south} AND ${b.north}`;

  // Every node in the bbox (untagged ones give ways their shape).
  await duck.run(`CREATE OR REPLACE TABLE osm_nodes AS SELECT id, lat, lon, tags FROM st_readosm(${q(pbf)}) WHERE kind = 'node' AND ${inBbox}`);
  // Tagged ways anywhere; those with a node in the bbox survive the join below.
  await duck.run(`
    CREATE OR REPLACE TABLE osm_ways AS
    SELECT w.id, w.tags, avg(n.lat) AS lat, avg(n.lon) AS lon, count(*) AS matched
    FROM (SELECT id, tags, refs FROM st_readosm(${q(pbf)}) WHERE kind = 'way' AND tags IS NOT NULL AND cardinality(tags) > 0
          AND (tags['place'] IS NOT NULL OR tags['leisure'] IS NOT NULL OR tags['railway'] IS NOT NULL OR tags['amenity'] IS NOT NULL
               OR tags['shop'] IS NOT NULL OR tags['public_transport'] IS NOT NULL OR tags['healthcare'] IS NOT NULL OR tags['office'] IS NOT NULL)) w,
         unnest(w.refs) AS r(ref)
    JOIN osm_nodes n ON n.id = r.ref
    GROUP BY w.id, w.tags`);
  await duck.run(`
    CREATE OR REPLACE TABLE osm_elems AS
    SELECT 'n' || id AS id, tags, lat, lon FROM osm_nodes WHERE tags IS NOT NULL AND cardinality(tags) > 0
    UNION ALL
    SELECT 'w' || id, tags, lat, lon FROM osm_ways WHERE ${inBbox.replace(/lon/g, 'lon').replace(/lat/g, 'lat')}`);

  await duck.run(`
    COPY (
      SELECT id, tags['name'] AS name, tags['place'] AS place, try_cast(tags['population'] AS INTEGER) AS population, lat, lon AS lng
      FROM osm_elems
      WHERE tags['place'] IN (${PLACE_VALUES.map(q).join(', ')}) AND tags['name'] IS NOT NULL
    ) TO ${q(out.places)} (FORMAT PARQUET, COMPRESSION ZSTD)`);

  await duck.run(`
    COPY (
      SELECT id, coalesce(tags['name'], tags['name:en']) AS name, lat, lon AS lng, ${keysListSql()} AS keys
      FROM (SELECT id, tags, lat, lon, ${osmKeyColumnsSql()} FROM osm_elems)
      WHERE ${anyKeySql()}
    ) TO ${q(out.pois)} (FORMAT PARQUET, COMPRESSION ZSTD)`);

  const places = await duck.one<{ n: number }>(`SELECT count(*) AS n FROM ${q(out.places)}`);
  const pois = await duck.one<{ n: number }>(`SELECT count(*) AS n FROM ${q(out.pois)}`);
  console.log(`  osm: ${places.n} place names, ${pois.n} tagged places in ${((Date.now() - t) / 1000).toFixed(0)} s`);
  return out;
}

/* CLI: npm run osm -- <cityId> [--force] */
if (process.argv[1] && /osm\.(ts|js)$/.test(process.argv[1])) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith('--'));
  if (!id) throw new Error('usage: npm run osm -- <cityId> [--force]');
  const duck = await openDuck();
  await extractOsm(duck, cityById(id), pbfFor(), args.includes('--force'));
  duck.close();
}
