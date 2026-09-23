import type { CategoryKey, Importance } from './categories.js';
import type { ScoreRow } from './scoring.js';
import type { RoutineNode } from './routine.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Viewport {
  sw: LatLng;
  ne: LatLng;
}

export interface CityInfo {
  id: string;
  name: string;
  subRegions?: string[];
}

export interface PlacePoint extends LatLng {
  placeId: string;
  category: CategoryKey;
  distanceM: number;
}

export interface BaselineRequest {
  placeId: string;
  anchorPlaceId?: string;
}

export interface BaselineResponse {
  home: LatLng & { formattedAddress: string; localityLabel: string; cityId?: string };
  anchor?: LatLng & { formattedAddress: string };
  baseline: { category: CategoryKey; count: number }[];
  places: PlacePoint[];
  sparse: boolean;
}

export interface MatchRequest {
  home: LatLng;
  anchor?: LatLng;
  cityId: string;
  categories: { category: CategoryKey; baselineCount: number; importance: Importance }[];
  routine: RoutineNode[];
}

export interface Explanation {
  characterLine: string;
  verdict: string;
  keep: string[];
  change: string[];
  giveUp: string[];
  gain: string[];
}

export interface LocalitySummary {
  id: number;
  name: string;
  subRegion?: string;
  center: LatLng;
  viewport: Viewport;
}

export interface MatchResult {
  locality: LocalitySummary;
  overall: number;
  rows: ScoreRow[];
  points: (LatLng & { category: CategoryKey })[];
  airportMinutes: number | null;
  anchorMinutes?: number | null;
  explanation: Explanation | null;
}

export interface MatchResponse {
  equivalentFound: boolean;
  cityName: string;
  results: MatchResult[];
}
