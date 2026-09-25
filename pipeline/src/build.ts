import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { q, type Duck } from './duck.js';
import { cityBbox, cityDir, type CityConfig } from './config.js';
import { keysListSql, overtureKeyColumnsSql } from './classify.js';
import { CATEGORIES, CATEGORY_KEYS, REACH_M, type CategoryKey } from '@locus/shared';

/**
 * Build a city's Locus dataset from the cached raw layers:
 *   pois.json        named places that count for at least one Locus category
 *   localities.json  data-derived localities with per-category counts within reach
 *   meta.json        city, airport, sources, counts
 *
 * Locality names come from three sources, merged:
 *   1. Overture division points (macrohood / neighborhood / town)
 *   2. OSM place nodes and areas (suburb / town / neighbourhood / quarter)
 *   3. the addresses of the places themselves - the token before the city name
 *      ("..., Kothrud, Pune 411038") - which is how residents actually name areas
 */

const MIN_CONFIDENCE = 0.4;
/** A locality must have this many places within 1 km to count as urban. */
const URBAN_MIN_POIS_1KM = 40;
/** Address-mined names need this many places using them, and a compact footprint. */
const ADDR_MIN_SUPPORT = 20;
const ADDR_PRIMARY_SUPPORT = 120;
const ADDR_MAX_SPREAD_M = 2000;
/** Secondary (society/colony-level) names are promoted when nothing bigger is near and they are busy. */
const PROMOTE_MIN_POIS_1KM = 150;
const PROMOTE_NO_PRIMARY_WITHIN_M = 900;
/** Duplicate rules: same/similar name nearby, or anything very close. */
const DEDUPE_SAME_NAME_M = 1500;
const DEDUPE_SIMILAR_NAME_M = 1200;
const DEDUPE_ANY_NAME_M = 250;
const NAME_SIMILARITY = 0.9;
const NEAREST_PER_KEY = 8;
const SEARCH_RADIUS_M = Math.max(...Object.values(REACH_M));

export interface BuildResult {
  localities: number;
  pois: number;
}

const PRIMARY_DIVISION_SQL = `
  (subtype = 'macrohood')
  OR (subtype = 'locality' AND (class IS NULL OR class IN ('town','suburb')))`;

/** Address segments that are not locality names. */
const ADDR_REJECT_RE =
  '(?i)(\\d|\\b(near|opp|opposite|behind|above|below|beside|next|off|floor|flr|shop|plot|survey|s\\.?no|bldg|building|complex|plaza|tower|towers|society|soc|apartment|apartments|chs|wing|gate|phase|sector|block|lane|road|rd|marg|path|street|st|highway|hwy|chowk|circle|corner|junction|naka|bridge|station|stand|depot|market|mandir|temple|hospital|school|college|mall|hotel|india|maharashtra|karnataka|gujarat|delhi|tamil nadu|telangana|west bengal|kerala|rajasthan|punjab|haryana|uttar pradesh|madhya pradesh|bihar|odisha|assam|jharkhand|chhattisgarh|uttarakhand|goa|andhra pradesh|pin|pincode|post|p\\.?o)\\b|^\\W*$)';

export async function buildCity(duck: Duck, city: CityConfig): Promise<BuildResult> {
  const raw = path.join(cityDir(city), 'raw');
  const out = cityDir(city);
  mkdirSync(out, { recursive: true });
  const bbox = cityBbox(city);
  const center = `ST_Point(${city.center.lng}, ${city.center.lat})`;
  const radiusM = city.radiusKm * 1000;
  const cityNames = [city.name, ...(city.subRegions?.map((s) => s.name) ?? [])];

  /* ---- POIs: Overture classified, OSM preferred for its categories and filling gaps elsewhere ---- */
  await duck.run(`
    CREATE OR REPLACE TABLE ov AS
    SELECT id, name, category, hierarchy, brand, confidence, addr, lat, lng, ST_Point(lng, lat) AS geom, ${overtureKeyColumnsSql()}
    FROM ${q(path.join(raw, 'places.parquet'))}
    WHERE confidence >= ${MIN_CONFIDENCE} AND coalesce(operating_status, 'open') = 'open' AND length(trim(name)) >= 2`);
  await duck.run(`
    CREATE OR REPLACE TABLE pois AS
    SELECT id, name, brand, confidence, lat, lng, geom, 'overture' AS source, ${keysListSql()} AS keys FROM ov WHERE len(${keysListSql()}) > 0`);

  const osmPois = path.join(raw, 'osm_pois.parquet');
  const hasOsm = existsSync(osmPois);
  if (hasOsm) {
    const preferOsm = CATEGORY_KEYS.filter((k) => CATEGORIES[k].prefer === 'osm');
    const preferList = preferOsm.map(q).join(', ');
    await duck.run(`
      CREATE OR REPLACE TABLE osm_p AS
      SELECT id, coalesce(name, '') AS name, NULL::VARCHAR AS brand, 0.6 AS confidence, lat, lng, ST_Point(lng, lat) AS geom, 'osm' AS source, keys
      FROM ${q(osmPois)} WHERE len(keys) > 0`);
    // Drop Overture's version of OSM-preferred categories.
    await duck.run(`UPDATE pois SET keys = list_filter(keys, k -> k NOT IN (${preferList}))`);
    await duck.run(`DELETE FROM pois WHERE len(keys) = 0`);
    // OSM rows: preferred categories always; other categories only where Overture has nothing within 60 m.
    await duck.run(`
      CREATE OR REPLACE TABLE osm_keys AS
      SELECT o.id, o.name, o.brand, o.confidence, o.lat, o.lng, o.geom, o.source, k.key
      FROM osm_p o, unnest(o.keys) AS k(key)`);
    await duck.run(`
      DELETE FROM osm_keys ok
      WHERE ok.key NOT IN (${preferList})
        AND EXISTS (SELECT 1 FROM pois p WHERE ST_Distance_Sphere(p.geom, ok.geom) < 60 AND list_contains(p.keys, ok.key))`);
    await duck.run(`
      INSERT INTO pois
      SELECT id, any_value(name), any_value(brand), any_value(confidence), any_value(lat), any_value(lng), any_value(geom), any_value(source), list(key)
      FROM osm_keys GROUP BY id`);
  }

  /* ---- Locality candidates ---- */
  await duck.run(`
    CREATE OR REPLACE TABLE cand AS
    SELECT id, name, lat, lng, ST_Point(lng, lat) AS geom,
           CASE WHEN ${PRIMARY_DIVISION_SQL} THEN 'primary' WHEN subtype = 'neighborhood' THEN 'secondary' END AS tier,
           'overture:' || subtype || coalesce('/' || class, '') AS kind, 0 AS support
    FROM ${q(path.join(raw, 'divisions.parquet'))}
    WHERE name IS NOT NULL`);
  await duck.run(`DELETE FROM cand WHERE tier IS NULL`);

  const osmPlaces = path.join(raw, 'osm_places.parquet');
  if (existsSync(osmPlaces)) {
    await duck.run(`
      INSERT INTO cand
      SELECT id, name, lat, lng, ST_Point(lng, lat) AS geom,
             CASE WHEN place IN ('suburb','town') THEN 'primary' WHEN place IN ('neighbourhood','quarter') THEN 'secondary' END AS tier,
             'osm:' || place AS kind, 0
      FROM ${q(osmPlaces)} WHERE place IN ('suburb','town','neighbourhood','quarter')`);
  }

  // 3. Address mining: the comma-separated segment right before the city name, or the
  //    last segment when the address stops short of the city ("..., Paud Rd, Kothrud").
  const cityMatch = cityNames.map((n) => `regexp_matches(seg, ${q(`(?i)^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)})`).join(' OR ');
  await duck.run(`
    CREATE OR REPLACE TABLE addr_tokens AS
    WITH segs AS (
      SELECT id, lat, lng, generate_subscripts(parts, 1) AS i, len(parts) AS n, trim(unnest(parts)) AS seg
      FROM (SELECT id, lat, lng, string_split(addr, ',') AS parts FROM ov WHERE addr IS NOT NULL)
    ),
    hits AS (SELECT id, min(i) AS i FROM segs WHERE ${cityMatch} AND i > 1 GROUP BY id),
    tok AS (
      SELECT s.id, s.lat, s.lng, s.seg AS token FROM hits h JOIN segs s ON s.id = h.id AND s.i = h.i - 1
      UNION ALL
      SELECT s.id, s.lat, s.lng, s.seg FROM segs s WHERE s.i = s.n AND s.n > 1 AND s.id NOT IN (SELECT id FROM hits)
    ),
    clean AS (
      SELECT id, lat, lng, trim(regexp_replace(regexp_replace(token, '(?i)\\s*(pune|pin)?\\s*[-–]?\\s*\\d{6}\\s*$', ''), '[\\s\\.\\-–]+$', '')) AS token FROM tok
    )
    SELECT lower(regexp_replace(token, '[^a-z0-9]', '', 'gi')) AS norm, token, lat, lng
    FROM clean
    WHERE length(token) BETWEEN 3 AND 32 AND NOT regexp_matches(token, ${q(ADDR_REJECT_RE)})
      AND lower(token) NOT IN (${cityNames.map((n) => q(n.toLowerCase())).join(', ')})`);
  await duck.run(`
    CREATE OR REPLACE TABLE addr_loc AS
    SELECT norm, arg_max(token, cnt) AS name, n AS support, lat, lng
    FROM (
      SELECT norm, token, count(*) OVER (PARTITION BY norm, token) AS cnt, n, lat, lng
      FROM (
        SELECT norm, token, count(*) OVER (PARTITION BY norm) AS n,
               quantile_cont(lat, 0.5) OVER (PARTITION BY norm) AS lat, quantile_cont(lng, 0.5) OVER (PARTITION BY norm) AS lng
        FROM addr_tokens
      )
    )
    WHERE n >= ${ADDR_MIN_SUPPORT}
    GROUP BY norm, n, lat, lng`);
  await duck.run(`
    CREATE OR REPLACE TABLE addr_loc2 AS
    SELECT a.*, (SELECT quantile_cont(ST_Distance_Sphere(ST_Point(t.lng, t.lat), ST_Point(a.lng, a.lat)), 0.5) FROM addr_tokens t WHERE t.norm = a.norm) AS spread
    FROM addr_loc a`);
  await duck.run(`
    INSERT INTO cand
    SELECT 'addr:' || norm, name, lat, lng, ST_Point(lng, lat), CASE WHEN support >= ${ADDR_PRIMARY_SUPPORT} THEN 'primary' ELSE 'secondary' END, 'address', support
    FROM addr_loc2 WHERE spread <= ${ADDR_MAX_SPREAD_M}`);

  // Out of range, the city itself, and administrative labels that are not places people name.
  await duck.run(`
    DELETE FROM cand
    WHERE ST_Distance_Sphere(geom, ${center}) > ${radiusM}
       OR lower(name) IN (${cityNames.map((n) => q(n.toLowerCase())).join(', ')})
       OR regexp_matches(name, '(?i)\\b(ward|zone|division|taluka|tehsil|district|circle|midc|sez|industrial (area|estate))\\b')`);

  /* Urbanity + promotion use the Overture place density around each candidate. */
  await duck.run(`
    CREATE OR REPLACE TABLE cand2 AS
    SELECT c.*, (SELECT count(*) FROM ov o WHERE ST_Distance_Sphere(o.geom, c.geom) <= 1000) AS pois_1km,
           lower(regexp_replace(c.name, '[^a-z0-9]', '', 'gi')) AS norm
    FROM cand c`);
  await duck.run(`DELETE FROM cand2 WHERE pois_1km < ${URBAN_MIN_POIS_1KM}`);
  await duck.run(`
    UPDATE cand2 SET tier = 'primary'
    WHERE tier = 'secondary' AND pois_1km >= ${PROMOTE_MIN_POIS_1KM}
      AND NOT EXISTS (SELECT 1 FROM cand2 p WHERE p.tier = 'primary' AND ST_Distance_Sphere(p.geom, cand2.geom) <= ${PROMOTE_NO_PRIMARY_WITHIN_M})`);

  /* Dedupe: a candidate loses to a better one that is the same/similar name nearby, or anything very near. */
  await duck.run(`
    CREATE OR REPLACE TABLE loc AS
    SELECT a.*, (a.pois_1km + 3 * a.support) AS score FROM cand2 a
    WHERE NOT EXISTS (
      SELECT 1 FROM cand2 b
      WHERE a.id <> b.id
        AND (
          (a.norm = b.norm AND ST_Distance_Sphere(a.geom, b.geom) <= ${DEDUPE_SAME_NAME_M})
          OR (jaro_winkler_similarity(a.norm, b.norm) >= ${NAME_SIMILARITY} AND ST_Distance_Sphere(a.geom, b.geom) <= ${DEDUPE_SIMILAR_NAME_M})
          OR ST_Distance_Sphere(a.geom, b.geom) <= ${DEDUPE_ANY_NAME_M}
        )
        AND (
          (b.tier = 'primary' AND a.tier = 'secondary')
          OR (b.tier = a.tier AND ((b.pois_1km + 3 * b.support) > (a.pois_1km + 3 * a.support)
               OR ((b.pois_1km + 3 * b.support) = (a.pois_1km + 3 * a.support) AND b.id < a.id)))
        )
    )`);

  /* ---- Per-locality counts within each category's reach, plus nearest place ids ---- */
  const countCols = CATEGORY_KEYS.map((k) => `count(*) FILTER (WHERE list_contains(p.keys, ${q(k)}) AND p.d <= ${REACH_M[CATEGORIES[k].reach]}) AS n_${k}`).join(',\n           ');
  await duck.run(`
    CREATE OR REPLACE TABLE loc_counts AS
    SELECT l.id, ${countCols}
    FROM loc l JOIN LATERAL (SELECT p.keys, ST_Distance_Sphere(p.geom, l.geom) AS d FROM pois p WHERE ST_Distance_Sphere(p.geom, l.geom) <= ${SEARCH_RADIUS_M}) p ON true
    GROUP BY l.id`);
  await duck.run(`
    CREATE OR REPLACE TABLE loc_nearest AS
    SELECT loc_id, key, list(poi_id ORDER BY d) FILTER (WHERE rn <= ${NEAREST_PER_KEY}) AS ids FROM (
      SELECT l.id AS loc_id, k.key, p.id AS poi_id, ST_Distance_Sphere(p.geom, l.geom) AS d,
             row_number() OVER (PARTITION BY l.id, k.key ORDER BY ST_Distance_Sphere(p.geom, l.geom)) AS rn
      FROM loc l
      JOIN pois p ON ST_Distance_Sphere(p.geom, l.geom) <= ${SEARCH_RADIUS_M}
      JOIN (SELECT unnest(p2.keys) AS key, p2.id FROM pois p2) k ON k.id = p.id
    ) GROUP BY 1, 2`);

  const subRegionSql = city.subRegions?.length
    ? `(SELECT name FROM (VALUES ${city.subRegions.map((s) => `(${q(s.name)}, ${s.center.lng}, ${s.center.lat})`).join(', ')}) sr(name, lng, lat) ORDER BY ST_Distance_Sphere(ST_Point(sr.lng, sr.lat), l.geom) LIMIT 1)`
    : 'NULL';

  const locRows = await duck.all<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    tier: string;
    kind: string;
    support: number;
    pois_1km: number;
    sub_region: string | null;
    counts: number[];
    nearest: { key: string; ids: string[] }[] | null;
  }>(`
    SELECT l.id, l.name, l.lat, l.lng, l.tier, l.kind, l.support, l.pois_1km, ${subRegionSql} AS sub_region,
           [${CATEGORY_KEYS.map((k) => `coalesce(c.n_${k}, 0)`).join(', ')}] AS counts,
           (SELECT list(struct_pack(key := n.key, ids := n.ids)) FROM loc_nearest n WHERE n.loc_id = l.id) AS nearest
    FROM loc l LEFT JOIN loc_counts c ON c.id = l.id
    ORDER BY l.tier, l.score DESC`);

  const poiRows = await duck.all<{ id: string; name: string; brand: string | null; confidence: number; lat: number; lng: number; source: string; keys: string[] }>(
    `SELECT id, name, brand, round(confidence, 2) AS confidence, round(lat, 6) AS lat, round(lng, 6) AS lng, source, keys FROM pois`,
  );

  const airport = (
    await duck.all<{ name: string; lat: number; lng: number }>(`
      SELECT name, lat, lng FROM ${q(path.join(raw, 'places.parquet'))}
      WHERE list_contains(coalesce(hierarchy, [category]), 'airport') AND regexp_matches(name, 'airport', 'i')
      ORDER BY (regexp_matches(name, 'international', 'i'))::INT DESC, confidence DESC LIMIT 1`)
  )[0];

  const localities = locRows.map((r, i) => ({
    id: i + 1,
    name: r.name,
    tier: r.tier,
    kind: r.kind,
    subRegion: r.sub_region ?? undefined,
    center: { lat: +r.lat.toFixed(6), lng: +r.lng.toFixed(6) },
    density: r.pois_1km,
    support: r.support || undefined,
    counts: Object.fromEntries(CATEGORY_KEYS.map((k, j) => [k, r.counts[j] ?? 0])) as Record<CategoryKey, number>,
    nearest: Object.fromEntries((r.nearest ?? []).map((n) => [n.key, n.ids])) as Partial<Record<CategoryKey, string[]>>,
  }));

  const pois = poiRows.map((p) => ({ id: p.id, name: p.name, brand: p.brand ?? undefined, conf: p.confidence, lat: p.lat, lng: p.lng, src: p.source === 'osm' ? 'o' : undefined, keys: p.keys }));

  const meta = {
    id: city.id,
    name: city.name,
    state: city.state,
    center: city.center,
    radiusKm: city.radiusKm,
    bbox,
    airport: airport ? { name: airport.name, lat: +airport.lat.toFixed(5), lng: +airport.lng.toFixed(5) } : null,
    keys: CATEGORY_KEYS,
    reach: REACH_M,
    builtAt: new Date().toISOString(),
    counts: {
      localities: localities.length,
      primary: localities.filter((l) => l.tier === 'primary').length,
      byKind: localities.reduce<Record<string, number>>((m, l) => ((m[l.kind] = (m[l.kind] ?? 0) + 1), m), {}),
      pois: pois.length,
    },
    sources: ['Overture Maps (places, divisions)', hasOsm ? 'OpenStreetMap (transit, parks, place names)' : null].filter(Boolean),
  };

  writeFileSync(path.join(out, 'localities.json'), JSON.stringify(localities));
  writeFileSync(path.join(out, 'pois.json'), JSON.stringify(pois));
  writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
  return { localities: localities.length, pois: pois.length };
}
