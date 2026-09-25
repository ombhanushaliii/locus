import type { CityData, CityMeta, DataIndex, LocalityRecord, Poi } from '@locus/shared';

/**
 * All product data is static JSON produced by the pipeline and served with the app
 * (client/public/data). Nothing here talks to a live service.
 */

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

let indexPromise: Promise<DataIndex> | null = null;
const cityPromises = new Map<string, Promise<CityData>>();

export function loadIndex(): Promise<DataIndex> {
  indexPromise ??= getJson<DataIndex>('index.json');
  return indexPromise;
}

export function loadCity(id: string): Promise<CityData> {
  let p = cityPromises.get(id);
  if (!p) {
    p = Promise.all([getJson<CityMeta>(`cities/${id}/meta.json`), getJson<LocalityRecord[]>(`cities/${id}/localities.json`), getJson<Poi[]>(`cities/${id}/pois.json`)]).then(
      ([meta, localities, pois]) => ({ meta, localities, pois }),
    );
    cityPromises.set(id, p);
  }
  return p;
}

/** Warm the destination's data while the user is still on the setup screen. */
export function prefetchCity(id: string): void {
  void loadCity(id).catch(() => cityPromises.delete(id));
}
