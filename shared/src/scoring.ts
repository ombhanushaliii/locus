import { CATEGORIES, type CategoryKey, type Importance } from './categories.js';

export const RADII_M: Record<CategoryKey, number> = Object.fromEntries(
  Object.values(CATEGORIES).map((c) => [c.key, c.radiusM]),
) as Record<CategoryKey, number>;

export const SCORE_CAP = 1.2;
export const WEIGHTS: Record<Exclude<Importance, 'none'>, number> = { must: 3, nice: 1 };
export const EQUIV_OVERALL = 85;
export const EQUIV_MUST_MIN = 70;
export const RESIDENTIAL_MIN_HOUSING = 5;
export const MEGASTORE_MIN_REVIEWS = 300;
export const MEGASTORE_MIN_RATING = 4.0;
export const SPARSE_BASELINE_TOTAL = 5;
export const NEARBY_MAX_RESULTS = 20;
export const LENS_DEFAULT_M = 1000;
/** Display thresholds for verdict language, as fractions of baseline. */
export const STRONG_MIN = 1.0;
export const WEAK_MAX = 0.7;
/** Verdict sentences name at most this many categories per clause. */
export const VERDICT_MAX_NAMED = 3;

export interface ScoreRow {
  category: CategoryKey;
  baseline: number;
  candidate: number;
  importance: Importance;
  /** candidate / baseline, capped at SCORE_CAP. */
  score: number;
}

export function categoryScore(baseline: number, candidate: number): number {
  const b = baseline === 0 ? 1 : baseline;
  return Math.min(candidate / b, SCORE_CAP);
}

export function keptRows(rows: readonly ScoreRow[]): ScoreRow[] {
  return rows.filter((r) => r.importance !== 'none');
}

/** Weighted mean x 100, rounded. Raw max is 120; clamp with displayOverall for UI. */
export function overall(rows: readonly ScoreRow[]): number {
  const kept = keptRows(rows);
  if (kept.length === 0) return 0;
  let num = 0;
  let den = 0;
  for (const r of kept) {
    const w = WEIGHTS[r.importance as 'must' | 'nice'];
    num += r.score * w;
    den += w;
  }
  return Math.round((100 * num) / den);
}

export function displayOverall(raw: number): number {
  return Math.min(100, Math.max(0, raw));
}

export function isEquivalent(rows: readonly ScoreRow[], overallScore: number): boolean {
  if (overallScore < EQUIV_OVERALL) return false;
  return rows.filter((r) => r.importance === 'must').every((r) => r.score * 100 >= EQUIV_MUST_MIN);
}

export function isSparse(baseline: readonly { count: number }[]): boolean {
  return baseline.reduce((s, b) => s + b.count, 0) < SPARSE_BASELINE_TOTAL;
}

export function buildRows(
  categories: readonly { category: CategoryKey; baselineCount: number; importance: Importance }[],
  candidateCounts: Readonly<Partial<Record<CategoryKey, number>>>,
): ScoreRow[] {
  return categories.map((c) => {
    const candidate = candidateCounts[c.category] ?? 0;
    return {
      category: c.category,
      baseline: c.baselineCount,
      candidate,
      importance: c.importance,
      score: categoryScore(c.baselineCount, candidate),
    };
  });
}

function joinList(labels: string[], more = 0): string {
  const all = more > 0 ? [...labels, more + ' more'] : labels;
  if (all.length <= 1) return all.join('');
  if (all.length === 2) return all[0] + ' and ' + all[1];
  return all.slice(0, -1).join(', ') + ', and ' + all[all.length - 1];
}

/** Deterministic one-liner used in the UI and as the LLM fallback. */
export function verdictLine(rows: readonly ScoreRow[]): string {
  const kept = keptRows(rows);
  const name = (r: ScoreRow) => CATEGORIES[r.category].label.toLowerCase();
  const strong = kept.filter((r) => r.score >= STRONG_MIN).sort((a, b) => b.score - a.score);
  const weak = kept.filter((r) => r.score < WEAK_MAX).sort((a, b) => a.score - b.score);
  const parts: string[] = [];
  if (strong.length) parts.push('Strong on ' + joinList(strong.slice(0, VERDICT_MAX_NAMED).map(name), strong.length - VERDICT_MAX_NAMED) + '.');
  if (weak.length) parts.push('Weaker on ' + joinList(weak.slice(0, VERDICT_MAX_NAMED).map(name), weak.length - VERDICT_MAX_NAMED) + '.');
  if (parts.length === 0) return 'Close to your current setup across the board.';
  return parts.join(' ');
}
