import { EQUIV_MUST_MIN, SCORE_CAP } from '@locus/shared';

interface Props {
  /** candidate / baseline, capped. */
  score: number;
  /** Optional second candidate for compare view. */
  score2?: number;
  isMust?: boolean;
}

/**
 * One hairline per category. Accent tick = yours (always 1.0). Ink tick = here.
 * A faint band marks the 70% must-have threshold. Replaces bars and stars.
 */
export function RangeStrip({ score, score2, isMust }: Props) {
  const max = SCORE_CAP;
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const failing = isMust && score * 100 < EQUIV_MUST_MIN;
  return (
    <div className={`strip${failing ? ' is-failing' : ''}`} aria-hidden>
      <span className="strip__band" style={{ left: 0, width: pct(EQUIV_MUST_MIN / 100) }} />
      <span className="strip__line" />
      <span className="strip__tick strip__tick--yours" style={{ left: pct(1) }} title="Yours" />
      <span className="strip__tick strip__tick--here" style={{ left: pct(score) }} title="Here" />
      {score2 !== undefined ? <span className="strip__tick strip__tick--here2" style={{ left: pct(score2) }} /> : null}
    </div>
  );
}
