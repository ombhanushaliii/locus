import { CATEGORIES, keptRows, type Explanation, type MatchResult } from '@locus/shared';

const label = (k: MatchResult['rows'][number]['category']) => CATEGORIES[k].label;

/** Deterministic lines from the ledger; used until (or instead of) the model's structured answer. */
export function fallbackExplanation(r: MatchResult, characterLine?: string): Explanation {
  const kept = keptRows(r.rows);
  const keep = kept
    .filter((x) => x.score >= 0.9 && x.score < 1.05)
    .slice(0, 3)
    .map((x) => `${label(x.category)} at a similar reach (${x.candidate} vs your ${x.baseline}).`);
  const change = kept
    .filter((x) => x.score >= 0.7 && x.score < 0.9)
    .slice(0, 3)
    .map((x) => `Fewer ${label(x.category).toLowerCase()} nearby (${x.candidate} vs your ${x.baseline}).`);
  const giveUp = kept
    .filter((x) => x.score < 0.7)
    .slice(0, 3)
    .map((x) => `${label(x.category)} drops to ${x.candidate} from your ${x.baseline}.`);
  const gain = kept
    .filter((x) => x.candidate > x.baseline)
    .sort((a, b) => b.candidate - b.baseline - (a.candidate - a.baseline))
    .slice(0, 3)
    .map((x) => `More ${label(x.category).toLowerCase()} (${x.candidate} vs your ${x.baseline}).`);

  const verdict =
    giveUp.length === 0
      ? 'Your routine carries over almost intact.'
      : `Most of your routine carries over; ${giveUp.length === 1 ? 'one gap' : `${giveUp.length} gaps`} to weigh.`;

  return {
    characterLine: characterLine ?? r.locality.subRegion ?? `${r.locality.name}.`,
    verdict,
    keep,
    change,
    giveUp,
    gain,
  };
}
