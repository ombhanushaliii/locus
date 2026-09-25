import { CATEGORIES, CATEGORY_KEYS, reachM, type CategoryKey } from './categories.js';
import { metersBetween } from './geo.js';
import { buildRows, isEquivalent, isSparse, NEARBY_MAX_RESULTS, overall } from './scoring.js';
import type { Baseline, BaselineCategory, CityData, HomePlace, LatLng, LocalityRecord, MatchResponse, MatchResult, PlacePoint, Poi } from './types.js';

/**
 * The whole product runs on static per-city files, so scanning a home and
 * matching a destination both happen here, in the browser.
 */

export const MATCH_TOP_N = 3;
/** City driving speed used for the airport / work estimates (no routing service). */
export const CITY_DRIVE_KMH = 22;

export function estimateDriveMinutes(a: LatLng, b: LatLng): number {
  return Math.round((metersBetween(a, b) / 1000 / CITY_DRIVE_KMH) * 60);
}

/** Everything that counts around a home, per category within that category's reach, nearest first. */
export function scanHome(home: HomePlace, pois: readonly Poi[], anchor?: Baseline['anchor']): Baseline {
  const maxReach = Math.max(...CATEGORY_KEYS.map(reachM));
  const near = pois
    .map((p) => ({ p, d: metersBetween(home, p) }))
    .filter((x) => x.d <= maxReach)
    .sort((a, b) => a.d - b.d);

  const counts = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Record<CategoryKey, number>;
  const places: PlacePoint[] = [];
  for (const { p, d } of near) {
    for (const k of p.keys) {
      if (d > reachM(k) || counts[k] >= NEARBY_MAX_RESULTS) continue;
      counts[k] += 1;
      places.push({ placeId: p.id, name: p.name, category: k, lat: p.lat, lng: p.lng, distanceM: Math.round(d) });
    }
  }
  return {
    home,
    anchor,
    counts,
    places,
    sparse: isSparse(CATEGORY_KEYS.map((k) => ({ count: counts[k] }))),
  };
}

function viewportFor(l: LocalityRecord) {
  // A soft footprint scaled by how busy the spot is: dense cores read smaller, spread-out suburbs larger.
  const half = l.density > 2500 ? 700 : l.density > 1200 ? 900 : 1100;
  const dLat = half / 111_320;
  const dLng = half / (111_320 * Math.cos((l.center.lat * Math.PI) / 180));
  return { sw: { lat: l.center.lat - dLat, lng: l.center.lng - dLng }, ne: { lat: l.center.lat + dLat, lng: l.center.lng + dLng } };
}

/** Capped counts so a dense core doesn't dwarf everything - the same ceiling the home scan uses. */
function cappedCounts(l: LocalityRecord): Partial<Record<CategoryKey, number>> {
  return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, Math.min(l.counts[k] ?? 0, NEARBY_MAX_RESULTS)]));
}

export interface MatchOptions {
  /** Exclude the locality the home sits in (same-city moves). */
  excludeNear?: LatLng;
  excludeWithinM?: number;
  anchor?: LatLng | null;
  characterFor?: (l: LocalityRecord) => string | undefined;
  /** Results must be at least this far apart, so three adjacent blocks don't fill the list. */
  minSeparationM?: number;
}

export const MATCH_MIN_SEPARATION_M = 1800;

export function matchCity(categories: readonly BaselineCategory[], city: CityData, opts: MatchOptions = {}): MatchResponse {
  const poiById = new Map(city.pois.map((p) => [p.id, p]));
  const excludeWithin = opts.excludeWithinM ?? 1200;
  const minSep = opts.minSeparationM ?? MATCH_MIN_SEPARATION_M;

  const ranked: MatchResult[] = city.localities
    .filter((l) => l.tier === 'primary')
    .filter((l) => !opts.excludeNear || metersBetween(l.center, opts.excludeNear) > excludeWithin)
    .map((l) => {
      const rows = buildRows(categories, cappedCounts(l));
      const points: MatchResult['points'] = [];
      for (const k of CATEGORY_KEYS) {
        for (const id of l.nearest[k] ?? []) {
          const p = poiById.get(id);
          if (p) points.push({ id: p.id, name: p.name, category: k, lat: p.lat, lng: p.lng });
        }
      }
      return {
        locality: { id: l.id, name: l.name, subRegion: l.subRegion, character: opts.characterFor?.(l), center: l.center, viewport: viewportFor(l) },
        overall: overall(rows),
        rows,
        points,
        airportMinutes: city.meta.airport ? estimateDriveMinutes(l.center, city.meta.airport) : null,
        anchorMinutes: opts.anchor ? estimateDriveMinutes(l.center, opts.anchor) : undefined,
      };
    })
    .sort((a, b) => b.overall - a.overall || b.rows.length - a.rows.length);

  const scored: MatchResult[] = [];
  for (const r of ranked) {
    if (scored.length >= MATCH_TOP_N) break;
    if (scored.some((s) => metersBetween(s.locality.center, r.locality.center) < minSep)) continue;
    scored.push(r);
  }

  return {
    equivalentFound: scored.some((r) => isEquivalent(r.rows, r.overall)),
    cityName: city.meta.name,
    results: scored,
  };
}

/** Which city's data covers a point, if any. */
export function cityContaining(point: LatLng, cities: readonly { id: string; bbox: { west: number; south: number; east: number; north: number } }[]): string | undefined {
  return cities.find((c) => point.lng >= c.bbox.west && point.lng <= c.bbox.east && point.lat >= c.bbox.south && point.lat <= c.bbox.north)?.id;
}

export { CATEGORIES };
