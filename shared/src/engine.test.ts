import { describe, expect, it } from 'vitest';
import { CATEGORY_KEYS, type CategoryKey } from './categories.js';
import { characterLine, cityMedians } from './character.js';
import { cityContaining, matchCity, scanHome } from './engine.js';
import { NEARBY_MAX_RESULTS } from './scoring.js';
import type { CityData, LocalityRecord, Poi } from './types.js';

const home = { lat: 18.5, lng: 73.85, label: 'Home', localityLabel: 'Test', cityId: 'x' };

function poi(id: string, key: CategoryKey, dEastM: number): Poi {
  return { id, name: id, conf: 0.9, lat: home.lat, lng: home.lng + dEastM / (111_320 * Math.cos((home.lat * Math.PI) / 180)), keys: [key] };
}

function locality(id: number, name: string, counts: Partial<Record<CategoryKey, number>>, density = 2000): LocalityRecord {
  return {
    id,
    name,
    tier: 'primary',
    kind: 'test',
    center: { lat: home.lat + id * 0.05, lng: home.lng },
    density,
    counts: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, counts[k] ?? 0])) as Record<CategoryKey, number>,
    nearest: {},
  };
}

describe('scanHome', () => {
  it('counts places inside each category reach only', () => {
    const b = scanHome(home, [poi('a', 'grocery', 500), poi('b', 'grocery', 900), poi('c', 'hospital', 2500), poi('d', 'hospital', 3500)]);
    expect(b.counts.grocery).toBe(1); // walk = 800 m
    expect(b.counts.hospital).toBe(1); // drive = 3000 m
    expect(b.places.map((p) => p.placeId)).toEqual(['a', 'c']);
    expect(b.sparse).toBe(true);
  });
  it('caps a category at the nearby ceiling', () => {
    const many = Array.from({ length: NEARBY_MAX_RESULTS + 10 }, (_, i) => poi(`r${i}`, 'restaurant', 100 + i * 10));
    expect(scanHome(home, many).counts.restaurant).toBe(NEARBY_MAX_RESULTS);
  });
});

describe('matchCity', () => {
  const city: CityData = {
    meta: { id: 'x', name: 'X', state: '', center: home, radiusKm: 20, bbox: { west: 73, south: 18, east: 74, north: 19 }, airport: { name: 'X Intl', lat: 18.6, lng: 73.9 }, keys: CATEGORY_KEYS, reach: { walk: 800, ride: 2000, drive: 3000 }, builtAt: '', counts: { localities: 2, primary: 2, byKind: {}, pois: 0 }, sources: [] },
    localities: [locality(1, 'Close', { grocery: 6, restaurant: 12 }), locality(2, 'Far', { grocery: 2, restaurant: 4 })],
    pois: [],
  };
  const categories = [
    { category: 'grocery' as const, baselineCount: 6, importance: 'must' as const },
    { category: 'restaurant' as const, baselineCount: 10, importance: 'nice' as const },
  ];
  it('ranks by overall and estimates airport minutes', () => {
    const m = matchCity(categories, city);
    expect(m.results.map((r) => r.locality.name)).toEqual(['Close', 'Far']);
    expect(m.equivalentFound).toBe(true);
    expect(m.results[0]!.airportMinutes).toBeGreaterThan(0);
  });
  it('excludes the locality the home is in for same-city moves', () => {
    const m = matchCity(categories, city, { excludeNear: city.localities[0]!.center, excludeWithinM: 500 });
    expect(m.results.map((r) => r.locality.name)).toEqual(['Far']);
  });
  it('spreads results out instead of listing adjacent blocks', () => {
    const twin = { ...locality(1, 'Close Twin', { grocery: 6, restaurant: 12 }), id: 9, center: { lat: city.localities[0]!.center.lat + 0.004, lng: home.lng } };
    const m = matchCity(categories, { ...city, localities: [...city.localities, twin] });
    expect(m.results.map((r) => r.locality.name)).toEqual(['Close', 'Far']);
    const loose = matchCity(categories, { ...city, localities: [...city.localities, twin] }, { minSeparationM: 100 });
    expect(loose.results).toHaveLength(3);
  });
});

describe('character', () => {
  it('names what a locality has more of than the city, and what it lacks', () => {
    const ls = [locality(1, 'A', { cafe: 20, nightlife: 10, park: 0, grocery: 5 }, 4000), locality(2, 'B', { cafe: 5, nightlife: 2, park: 4, grocery: 5 }), locality(3, 'C', { cafe: 4, nightlife: 2, park: 4, grocery: 5 })];
    const med = cityMedians(ls);
    expect(characterLine(ls[0]!, med)).toBe('Dense, with more nightlife and cafés than most of the city; light on parks.');
    expect(characterLine(ls[2]!, med)).toBe('Busy, with an even mix of everyday places.');
  });
});

describe('cityContaining', () => {
  it('finds the city whose bbox holds the point', () => {
    const cities = [{ id: 'a', bbox: { west: 0, south: 0, east: 1, north: 1 } }, { id: 'b', bbox: { west: 10, south: 10, east: 11, north: 11 } }];
    expect(cityContaining({ lat: 10.5, lng: 10.5 }, cities)).toBe('b');
    expect(cityContaining({ lat: 5, lng: 5 }, cities)).toBeUndefined();
  });
});
