import type { SearchEntry } from '@locus/shared';

/**
 * Tiny in-memory search over the index's locality and city names. Prefix and
 * word-start matches rank above substring hits; ties broken by how well-known
 * the place is (address support + density).
 */

export interface Hit {
  entry: SearchEntry;
  score: number;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchPlaces(entries: readonly SearchEntry[], query: string, limit = 8, cityId?: string): Hit[] {
  const qn = normalize(query);
  if (qn.length < 2) return [];
  const qWords = qn.split(' ');
  const hits: Hit[] = [];
  for (const e of entries) {
    const n = normalize(e.name);
    if (!n) continue;
    let score = 0;
    if (n === qn) score = 100;
    else if (n.startsWith(qn)) score = 80;
    else if (n.split(' ').some((w) => w.startsWith(qn))) score = 60;
    else if (qWords.every((w) => n.includes(w))) score = 40;
    else continue;
    if (e.k === 'c') score += 5;
    if (cityId && e.city === cityId) score += 10;
    score += Math.min(20, Math.log10(1 + e.w) * 4);
    hits.push({ entry: e, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.name.length - b.entry.name.length).slice(0, limit);
}
