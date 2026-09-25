import type { CategoryKey, Importance, Reach } from './categories.js';
import type { ScoreRow } from './scoring.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Viewport {
  sw: LatLng;
  ne: LatLng;
}

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/* ---- Static data produced by the pipeline (data/cities/<id>/*.json, data/index.json) ---- */

export interface CityMeta {
  id: string;
  name: string;
  state: string;
  center: LatLng;
  radiusKm: number;
  bbox: Bbox;
  airport: { name: string; lat: number; lng: number } | null;
  keys: readonly CategoryKey[];
  reach: Record<Reach, number>;
  builtAt: string;
  counts: { localities: number; primary: number; byKind: Record<string, number>; pois: number };
  sources: string[];
}

export interface LocalityRecord {
  id: number;
  name: string;
  tier: 'primary' | 'secondary';
  kind: string;
  subRegion?: string;
  center: LatLng;
  /** Places of any kind within 1 km - how urban the spot is. */
  density: number;
  /** How many addresses name this locality (address-mined names only). */
  support?: number;
  counts: Record<CategoryKey, number>;
  /** Nearest place ids per category, closest first, for drawing routines. */
  nearest: Partial<Record<CategoryKey, string[]>>;
}

export interface Poi {
  id: string;
  name: string;
  brand?: string;
  conf: number;
  lat: number;
  lng: number;
  /** 'o' when the place came from OSM rather than Overture. */
  src?: 'o';
  keys: CategoryKey[];
}

export interface CityData {
  meta: CityMeta;
  localities: LocalityRecord[];
  pois: Poi[];
}

export interface CityIndexEntry {
  id: string;
  name: string;
  state: string;
  center: LatLng;
  bbox: Bbox;
  localities: number;
}

export interface SearchEntry {
  /** 'l' locality, 'c' city */
  k: 'l' | 'c';
  name: string;
  city: string;
  lat: number;
  lng: number;
  /** locality id within its city */
  id?: number;
  /** address support / density, for ranking */
  w: number;
}

export interface DataIndex {
  builtAt: string;
  cities: CityIndexEntry[];
  search: SearchEntry[];
}

/* ---- App-level shapes ---- */

export interface CityInfo {
  id: string;
  name: string;
  state?: string;
}

export interface HomePlace extends LatLng {
  label: string;
  localityLabel: string;
  cityId: string;
}

export interface PlacePoint extends LatLng {
  placeId: string;
  name: string;
  category: CategoryKey;
  distanceM: number;
}

export interface Baseline {
  home: HomePlace;
  anchor?: LatLng & { label: string };
  counts: Record<CategoryKey, number>;
  places: PlacePoint[];
  sparse: boolean;
}

export interface BaselineCategory {
  category: CategoryKey;
  baselineCount: number;
  importance: Importance;
}

export interface LocalitySummary {
  id: number;
  name: string;
  subRegion?: string;
  /** Derived from the data, e.g. "Dense with cafés and nightlife; light on parks." */
  character?: string;
  center: LatLng;
  viewport: Viewport;
}

export interface MatchResult {
  locality: LocalitySummary;
  overall: number;
  rows: ScoreRow[];
  points: (LatLng & { category: CategoryKey; id: string; name: string })[];
  airportMinutes: number | null;
  anchorMinutes?: number | null;
}

export interface MatchResponse {
  equivalentFound: boolean;
  cityName: string;
  results: MatchResult[];
}
