import { NEARBY_MAX_RESULTS, type LatLng, type Suggestion, type Viewport } from '@locus/shared';

function key(): string {
  const k = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!k) throw new Error('GOOGLE_MAPS_SERVER_KEY is not set');
  return k;
}

export class GoogleError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    body: string,
  ) {
    super(`${endpoint} ${status}: ${body.slice(0, 300)}`);
  }
}

async function call<T>(endpoint: string, init: RequestInit): Promise<T> {
  const res = await fetch(endpoint, init);
  if (!res.ok) throw new GoogleError(endpoint, res.status, await res.text());
  return (await res.json()) as T;
}

function placesPost<T>(path: string, fieldMask: string, body: unknown): Promise<T> {
  return call<T>(`https://places.googleapis.com/v1/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
  });
}

/* ---- Places Autocomplete (New) ---- */

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
}

export async function autocomplete(input: string): Promise<Suggestion[]> {
  if (!input.trim()) return [];
  const data = await placesPost<AutocompleteResponse>('places:autocomplete', '*', {
    input,
    includedRegionCodes: ['in'],
    languageCode: 'en',
  });
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 5)
    .map((p) => ({
      placeId: p.placeId,
      label: p.structuredFormat?.mainText?.text ?? p.text.text,
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
}

/* ---- Place Details (New): location only ---- */

interface PlaceDetails {
  id: string;
  location: { latitude: number; longitude: number };
  formattedAddress?: string;
  addressComponents?: { longText: string; types: string[] }[];
}

const LOCALITY_TYPES = ['sublocality_level_1', 'sublocality', 'neighborhood', 'locality'];

export async function placeLocation(placeId: string): Promise<{ location: LatLng; formattedAddress: string; localityLabel: string }> {
  const p = await call<PlaceDetails>(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': 'id,location,formattedAddress,addressComponents' },
  });
  const comps = p.addressComponents ?? [];
  const label = LOCALITY_TYPES.map((t) => comps.find((c) => c.types.includes(t))?.longText).find(Boolean);
  return {
    location: { lat: p.location.latitude, lng: p.location.longitude },
    formattedAddress: p.formattedAddress ?? '',
    localityLabel: label ?? p.formattedAddress?.split(',')[0] ?? 'Your area',
  };
}

/* ---- Nearby Search (New) ---- */

export interface NearbyPlace {
  id: string;
  location: LatLng;
  rating?: number;
  userRatingCount?: number;
}

interface NearbyResponse {
  places?: { id: string; location: { latitude: number; longitude: number }; rating?: number; userRatingCount?: number }[];
}

export async function nearby(center: LatLng, radiusM: number, includedTypes: readonly string[], withRating = false): Promise<NearbyPlace[]> {
  const mask = withRating ? 'places.id,places.location,places.rating,places.userRatingCount' : 'places.id,places.location';
  const data = await placesPost<NearbyResponse>('places:searchNearby', mask, {
    includedTypes,
    maxResultCount: NEARBY_MAX_RESULTS,
    locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM } },
  });
  return (data.places ?? []).map((p) => ({
    id: p.id,
    location: { lat: p.location.latitude, lng: p.location.longitude },
    rating: p.rating,
    userRatingCount: p.userRatingCount,
  }));
}

/* ---- Geocoding ---- */

interface GeocodeResponse {
  status: string;
  error_message?: string;
  results: {
    geometry: {
      location: { lat: number; lng: number };
      viewport: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } };
    };
  }[];
}

export async function geocode(address: string): Promise<{ location: LatLng; viewport: Viewport } | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'in');
  url.searchParams.set('key', key());
  const data = await call<GeocodeResponse>(url.toString(), {});
  if (data.status === 'ZERO_RESULTS') return null;
  if (data.status !== 'OK') throw new GoogleError('geocode', 403, `${data.status}: ${data.error_message ?? ''}`);
  const r = data.results[0];
  if (!r) return null;
  return {
    location: r.geometry.location,
    viewport: { sw: r.geometry.viewport.southwest, ne: r.geometry.viewport.northeast },
  };
}

/* ---- Routes ---- */

interface RoutesResponse {
  routes?: { duration: string }[];
}

export async function driveMinutes(origin: LatLng, destination: LatLng | { placeId: string }): Promise<number | null> {
  const toWaypoint = (p: LatLng | { placeId: string }) =>
    'placeId' in p ? { placeId: p.placeId } : { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
  try {
    const data = await call<RoutesResponse>('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': 'routes.duration' },
      body: JSON.stringify({ origin: toWaypoint(origin), destination: toWaypoint(destination), travelMode: 'DRIVE' }),
    });
    const secs = Number.parseInt(data.routes?.[0]?.duration ?? '', 10);
    return Number.isFinite(secs) ? Math.round(secs / 60) : null;
  } catch {
    return null;
  }
}
