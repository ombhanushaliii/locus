import type { BaselineRequest, BaselineResponse, CityInfo, MatchRequest, MatchResponse } from '@locus/shared';
import { mockBaseline, mockCities, mockMatch, mockSuggest, type Suggestion } from './mock/data';

/** Mock mode runs the whole flow without Google or a database. */
export const MOCK = import.meta.env.VITE_MOCK === '1' || !import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function getCities(): Promise<CityInfo[]> {
  if (MOCK) return mockCities();
  const res = await fetch('/api/cities');
  if (!res.ok) throw new Error(`/api/cities failed: ${res.status}`);
  return (await res.json()) as CityInfo[];
}

export async function suggestAddresses(q: string): Promise<Suggestion[]> {
  if (MOCK) return mockSuggest(q);
  const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`/api/suggest failed: ${res.status}`);
  return (await res.json()) as Suggestion[];
}

export async function fetchBaseline(req: BaselineRequest): Promise<BaselineResponse> {
  if (MOCK) return mockBaseline(req);
  return post<BaselineResponse>('/api/baseline', req);
}

export async function fetchMatch(req: MatchRequest): Promise<MatchResponse> {
  if (MOCK) return mockMatch(req);
  return post<MatchResponse>('/api/match', req);
}
