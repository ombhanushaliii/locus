import type { CategoryKey, Importance } from './categories.js';

export type RoutineNode = 'home' | 'anchor' | CategoryKey;

/** Canonical order a day tends to unfold in. Display only - never scored. */
export const ROUTINE_ORDER: readonly RoutineNode[] = [
  'transit',
  'anchor',
  'grocery',
  'fitness',
  'food',
  'healthcare',
  'education',
  'entertainment',
  'megastore',
  'worship',
];

export function deriveRoutine(
  rows: readonly { category: CategoryKey; importance: Importance }[],
  hasAnchor: boolean,
): RoutineNode[] {
  const must = new Set(rows.filter((r) => r.importance === 'must').map((r) => r.category));
  const middle = ROUTINE_ORDER.filter((n) => (n === 'anchor' ? hasAnchor : must.has(n as CategoryKey)));
  return ['home', ...middle, 'home'];
}

export const ROUTINE_LABELS: Record<RoutineNode, string> = {
  home: 'HOME',
  anchor: 'WORK',
  grocery: 'GROCERY',
  megastore: 'MEGASTORE',
  healthcare: 'HEALTH',
  fitness: 'GYM',
  food: 'FOOD',
  transit: 'TRANSIT',
  education: 'STUDY',
  entertainment: 'OUT',
  worship: 'WORSHIP',
};
