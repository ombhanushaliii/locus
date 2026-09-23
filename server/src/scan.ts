import {
  CATEGORIES,
  CATEGORY_KEYS,
  HOUSING_KEY,
  HOUSING_RADIUS_M,
  HOUSING_TYPES,
  MEGASTORE_MIN_RATING,
  MEGASTORE_MIN_REVIEWS,
  metersBetween,
  type CategoryKey,
  type LatLng,
  type PlacePoint,
  type ScanKey,
} from '@locus/shared';
import { nearby, type NearbyPlace } from './google.js';

export interface CategoryScan {
  count: number;
  places: NearbyPlace[];
}

export type PointScan = Record<ScanKey, CategoryScan>;

function isMegastore(p: NearbyPlace): boolean {
  return (p.userRatingCount ?? 0) >= MEGASTORE_MIN_REVIEWS && (p.rating ?? 0) >= MEGASTORE_MIN_RATING;
}

/** One Nearby Search per category (plus housing) around a point, all in parallel. */
export async function scanAround(center: LatLng, includeHousing: boolean): Promise<PointScan> {
  const jobs = CATEGORY_KEYS.map(async (k) => {
    const def = CATEGORIES[k];
    const raw = await nearby(center, def.radiusM, def.includedTypes, k === 'megastore');
    const places = k === 'megastore' ? raw.filter(isMegastore) : raw;
    return [k, { count: places.length, places }] as const;
  });
  const housing = includeHousing
    ? nearby(center, HOUSING_RADIUS_M, HOUSING_TYPES).then((places) => [HOUSING_KEY, { count: places.length, places }] as const)
    : Promise.resolve([HOUSING_KEY, { count: 0, places: [] }] as const);
  const entries = await Promise.all([...jobs, housing]);
  return Object.fromEntries(entries) as PointScan;
}

export function toPlacePoints(center: LatLng, scan: PointScan): PlacePoint[] {
  return CATEGORY_KEYS.flatMap((k: CategoryKey) =>
    scan[k].places.map((p) => ({
      placeId: p.id,
      category: k,
      lat: p.location.lat,
      lng: p.location.lng,
      distanceM: Math.round(metersBetween(center, p.location)),
    })),
  );
}
