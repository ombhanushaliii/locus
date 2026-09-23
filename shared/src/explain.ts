import { CATEGORIES } from './categories.js';
import { keptRows, type ScoreRow } from './scoring.js';

export interface Explanation {
  verdict: string;
  keep: string[];
  change: string[];
  giveUp: string[];
  gain: string[];
}

export const EXPLAIN_MAX_LINES = 3;
/** Rows within this band of baseline read as "kept". */
export const KEEP_MIN = 0.9;
export const KEEP_MAX = 1.05;
/** Rows between WEAK and KEEP_MIN read as "changed"; below WEAK as "given up". */
export const CHANGE_MIN = 0.7;

const label = (r: ScoreRow) => CATEGORIES[r.category].label;

export function explainRows(rows: readonly ScoreRow[]): Explanation {
  const kept = keptRows(rows);
  const keep = kept
    .filter((x) => x.score >= KEEP_MIN && x.score < KEEP_MAX)
    .slice(0, EXPLAIN_MAX_LINES)
    .map((x) => `${label(x)} at a similar reach (${x.candidate} vs your ${x.baseline}).`);
  const change = kept
    .filter((x) => x.score >= CHANGE_MIN && x.score < KEEP_MIN)
    .slice(0, EXPLAIN_MAX_LINES)
    .map((x) => `Fewer ${label(x).toLowerCase()} nearby (${x.candidate} vs your ${x.baseline}).`);
  const giveUp = kept
    .filter((x) => x.score < CHANGE_MIN)
    .slice(0, EXPLAIN_MAX_LINES)
    .map((x) => `${label(x)} drops to ${x.candidate} from your ${x.baseline}.`);
  const gain = kept
    .filter((x) => x.candidate > x.baseline)
    .sort((a, b) => b.candidate - b.baseline - (a.candidate - a.baseline))
    .slice(0, EXPLAIN_MAX_LINES)
    .map((x) => `More ${label(x).toLowerCase()} (${x.candidate} vs your ${x.baseline}).`);

  const verdict =
    giveUp.length === 0
      ? 'Your routine carries over almost intact.'
      : `Most of your routine carries over; ${giveUp.length === 1 ? 'one gap' : `${giveUp.length} gaps`} to weigh.`;

  return { verdict, keep, change, giveUp, gain };
}
