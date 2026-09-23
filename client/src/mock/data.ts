import {
  CATEGORIES,
  CATEGORY_KEYS,
  buildRows,
  isEquivalent,
  isSparse,
  overall,
  type BaselineRequest,
  type BaselineResponse,
  type CategoryKey,
  type CityInfo,
  type LatLng,
  type MatchRequest,
  type MatchResponse,
  type MatchResult,
  type PlacePoint,
  type Suggestion,
} from '@locus/shared';

/* Deterministic pseudo-random so the demo map looks the same every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function scatter(center: LatLng, radiusM: number, n: number, seed: number, category: CategoryKey, prefix: string): PlacePoint[] {
  const r = rng(seed);
  const out: PlacePoint[] = [];
  for (let i = 0; i < n; i++) {
    const d = radiusM * Math.sqrt(0.15 + 0.85 * r());
    const a = r() * Math.PI * 2;
    const dLat = (d * Math.cos(a)) / 111_320;
    const dLng = (d * Math.sin(a)) / (111_320 * Math.cos((center.lat * Math.PI) / 180));
    out.push({
      placeId: `${prefix}-${category}-${i}`,
      category,
      lat: center.lat + dLat,
      lng: center.lng + dLng,
      distanceM: Math.round(d),
    });
  }
  return out;
}

const HOMES: Record<string, { label: string; secondary: string; center: LatLng; locality: string; cityId?: string; counts: Record<CategoryKey, number> }> = {
  'mock-bandra': {
    label: 'Bandra West',
    secondary: 'Mumbai, Maharashtra',
    center: { lat: 19.0596, lng: 72.8295 },
    locality: 'Bandra West',
    cityId: 'mumbai',
    counts: { grocery: 6, megastore: 2, healthcare: 9, fitness: 2, food: 14, transit: 3, education: 5, entertainment: 4, worship: 3 },
  },
  'mock-indiranagar': {
    label: 'Indiranagar',
    secondary: 'Bengaluru, Karnataka',
    center: { lat: 12.9784, lng: 77.6408 },
    locality: 'Indiranagar',
    cityId: 'bengaluru',
    counts: { grocery: 8, megastore: 3, healthcare: 12, fitness: 6, food: 20, transit: 2, education: 4, entertainment: 6, worship: 2 },
  },
  'mock-quiet': {
    label: 'Lonavala',
    secondary: 'Maharashtra',
    center: { lat: 18.7546, lng: 73.4062 },
    locality: 'Lonavala',
    counts: { grocery: 1, megastore: 0, healthcare: 1, fitness: 0, food: 2, transit: 0, education: 1, entertainment: 0, worship: 1 },
  },
};

const ANCHORS: Record<string, { label: string; secondary: string; center: LatLng }> = {
  'mock-bkc': { label: 'Bandra Kurla Complex', secondary: 'Mumbai, Maharashtra', center: { lat: 19.0653, lng: 72.8656 } },
  'mock-hinjewadi': { label: 'Hinjewadi Phase 1', secondary: 'Pune, Maharashtra', center: { lat: 18.5912, lng: 73.7389 } },
};

export function mockCities(): CityInfo[] {
  return [
    { id: 'mumbai', name: 'Mumbai' },
    { id: 'pune', name: 'Pune' },
    { id: 'bengaluru', name: 'Bengaluru' },
    { id: 'delhi-ncr', name: 'Delhi NCR', subRegions: ['Delhi', 'Gurugram', 'Noida'] },
  ];
}

export function mockSuggest(q: string): Suggestion[] {
  const all: Suggestion[] = [
    ...Object.entries(HOMES).map(([placeId, h]) => ({ placeId, label: h.label, secondary: h.secondary })),
    ...Object.entries(ANCHORS).map(([placeId, h]) => ({ placeId, label: h.label, secondary: h.secondary })),
  ];
  const needle = q.trim().toLowerCase();
  if (!needle) return all.slice(0, 3);
  return all.filter((s) => `${s.label} ${s.secondary}`.toLowerCase().includes(needle)).slice(0, 5);
}

export function mockBaseline(req: BaselineRequest): BaselineResponse {
  const h = HOMES[req.placeId] ?? HOMES['mock-bandra']!;
  const places = CATEGORY_KEYS.flatMap((k, i) => scatter(h.center, CATEGORIES[k].radiusM, h.counts[k], 1000 + i * 17, k, req.placeId));
  const baseline = CATEGORY_KEYS.map((k) => ({ category: k, count: h.counts[k] }));
  const anchor = req.anchorPlaceId ? ANCHORS[req.anchorPlaceId] : undefined;
  return {
    home: { ...h.center, formattedAddress: `${h.label}, ${h.secondary}`, localityLabel: h.locality, cityId: h.cityId },
    anchor: anchor ? { ...anchor.center, formattedAddress: `${anchor.label}, ${anchor.secondary}` } : undefined,
    baseline,
    places,
    sparse: isSparse(baseline),
  };
}

interface MockLocality {
  id: number;
  name: string;
  subRegion?: string;
  center: LatLng;
  counts: Record<CategoryKey, number>;
  airportMinutes: number;
  character: string;
}

const LOCALITIES: Record<string, MockLocality[]> = {
  pune: [
    { id: 101, name: 'Aundh', center: { lat: 18.559, lng: 73.8075 }, counts: { grocery: 6, megastore: 2, healthcare: 5, fitness: 1, food: 16, transit: 3, education: 6, entertainment: 5, worship: 4 }, airportMinutes: 34, character: 'Quiet, tree-lined, well-connected.' },
    { id: 102, name: 'Baner', center: { lat: 18.559, lng: 73.7868 }, counts: { grocery: 5, megastore: 3, healthcare: 4, fitness: 2, food: 18, transit: 1, education: 4, entertainment: 6, worship: 2 }, airportMinutes: 40, character: 'Newer, busier, restaurant-heavy.' },
    { id: 103, name: 'Kothrud', center: { lat: 18.5074, lng: 73.8077 }, counts: { grocery: 7, megastore: 1, healthcare: 6, fitness: 1, food: 9, transit: 2, education: 8, entertainment: 3, worship: 6 }, airportMinutes: 45, character: 'Settled, residential, school-dense.' },
    { id: 104, name: 'Viman Nagar', center: { lat: 18.5679, lng: 73.9143 }, counts: { grocery: 4, megastore: 2, healthcare: 3, fitness: 3, food: 15, transit: 1, education: 3, entertainment: 7, worship: 1 }, airportMinutes: 9, character: 'Near the airport, mall-centred.' },
    { id: 105, name: 'Koregaon Park', center: { lat: 18.5362, lng: 73.8939 }, counts: { grocery: 3, megastore: 1, healthcare: 4, fitness: 4, food: 20, transit: 2, education: 2, entertainment: 6, worship: 2 }, airportMinutes: 20, character: 'Leafy, cafe-first, low on groceries.' },
  ],
  mumbai: [
    { id: 201, name: 'Khar West', center: { lat: 19.0728, lng: 72.8326 }, counts: { grocery: 5, megastore: 2, healthcare: 8, fitness: 3, food: 15, transit: 3, education: 4, entertainment: 3, worship: 3 }, airportMinutes: 25, character: 'Bandra, one stop north.' },
    { id: 202, name: 'Powai', center: { lat: 19.1176, lng: 72.906 }, counts: { grocery: 6, megastore: 3, healthcare: 7, fitness: 4, food: 12, transit: 1, education: 6, entertainment: 5, worship: 2 }, airportMinutes: 30, character: 'Planned, lakeside, car-dependent.' },
    { id: 203, name: 'Chembur', center: { lat: 19.0522, lng: 72.9005 }, counts: { grocery: 7, megastore: 2, healthcare: 9, fitness: 2, food: 10, transit: 4, education: 5, entertainment: 3, worship: 5 }, airportMinutes: 35, character: 'Old suburb, well-served, unglamorous.' },
  ],
  bengaluru: [
    { id: 301, name: 'Koramangala', center: { lat: 12.9352, lng: 77.6245 }, counts: { grocery: 7, megastore: 3, healthcare: 10, fitness: 6, food: 20, transit: 1, education: 4, entertainment: 6, worship: 2 }, airportMinutes: 75, character: 'Dense, young, everything walkable.' },
    { id: 302, name: 'Jayanagar', center: { lat: 12.9308, lng: 77.5838 }, counts: { grocery: 9, megastore: 2, healthcare: 11, fitness: 3, food: 14, transit: 2, education: 6, entertainment: 3, worship: 6 }, airportMinutes: 80, character: 'Old Bengaluru, grocery-rich.' },
    { id: 303, name: 'Whitefield', center: { lat: 12.9698, lng: 77.7499 }, counts: { grocery: 5, megastore: 4, healthcare: 6, fitness: 5, food: 13, transit: 1, education: 5, entertainment: 7, worship: 1 }, airportMinutes: 70, character: 'Tech corridor, malls, long roads.' },
  ],
  'delhi-ncr': [
    { id: 401, name: 'Hauz Khas', subRegion: 'Delhi', center: { lat: 28.5494, lng: 77.2001 }, counts: { grocery: 5, megastore: 1, healthcare: 7, fitness: 3, food: 16, transit: 2, education: 5, entertainment: 5, worship: 3 }, airportMinutes: 30, character: 'Village lanes, deer park, metro.' },
    { id: 402, name: 'Sector 29', subRegion: 'Gurugram', center: { lat: 28.4691, lng: 77.0636 }, counts: { grocery: 4, megastore: 3, healthcare: 5, fitness: 5, food: 20, transit: 1, education: 2, entertainment: 6, worship: 1 }, airportMinutes: 35, character: 'Nightlife grid, few groceries.' },
    { id: 403, name: 'Sector 18', subRegion: 'Noida', center: { lat: 28.5708, lng: 77.3261 }, counts: { grocery: 6, megastore: 3, healthcare: 6, fitness: 3, food: 15, transit: 2, education: 4, entertainment: 7, worship: 2 }, airportMinutes: 55, character: 'Mall district with a metro spine.' },
  ],
};

function viewportFor(c: LatLng) {
  return { sw: { lat: c.lat - 0.011, lng: c.lng - 0.012 }, ne: { lat: c.lat + 0.011, lng: c.lng + 0.012 } };
}

function haversineMin(a: LatLng, b: LatLng): number {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const m = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round((m / 1000 / 22) * 60); // ~22 km/h city driving
}

export function mockMatch(req: MatchRequest): MatchResponse {
  const cityName = mockCities().find((c) => c.id === req.cityId)?.name ?? req.cityId;
  const pool = (LOCALITIES[req.cityId] ?? []).filter((l) => haversineMin(l.center, req.home) > 6);
  const scored: MatchResult[] = pool
    .map((l) => {
      const rows = buildRows(req.categories, l.counts);
      const points = CATEGORY_KEYS.flatMap((k, i) =>
        scatter(l.center, CATEGORIES[k].radiusM, l.counts[k], l.id * 31 + i, k, `loc-${l.id}`).map(({ lat, lng, category }) => ({ lat, lng, category })),
      );
      return {
        locality: { id: l.id, name: l.name, subRegion: l.subRegion, character: l.character, center: l.center, viewport: viewportFor(l.center) },
        overall: overall(rows),
        rows,
        points,
        airportMinutes: l.airportMinutes,
        anchorMinutes: req.anchor ? haversineMin(l.center, req.anchor) : undefined,
      };
    })
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3);
  const equivalentFound = scored.some((r) => isEquivalent(r.rows, r.overall));
  return { equivalentFound, cityName, results: scored };
}
