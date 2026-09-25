import { CATEGORIES, type CategoryKey, type Importance } from './categories.js';

export type RoutineNode = 'home' | 'anchor' | CategoryKey;

/** Canonical order a day tends to unfold in. Display only - never scored. */
export const ROUTINE_ORDER: readonly RoutineNode[] = [
  'bus',
  'rail',
  'anchor',
  'cafe',
  'preschool',
  'school',
  'college',
  'coworking',
  'grocery',
  'supermarket',
  'pharmacy',
  'bank',
  'gym',
  'yoga',
  'park',
  'restaurant',
  'bakery',
  'salon',
  'clinic',
  'hospital',
  'cinema',
  'mall',
  'nightlife',
  'worship',
  'pet',
  'fuel',
];

/** Home → each must-have stop in day order → home. Capped so the thread stays readable. */
export const ROUTINE_MAX_STOPS = 6;

export function deriveRoutine(rows: readonly { category: CategoryKey; importance: Importance }[], hasAnchor: boolean): RoutineNode[] {
  const must = new Set(rows.filter((r) => r.importance === 'must').map((r) => r.category));
  const middle = ROUTINE_ORDER.filter((n) => (n === 'anchor' ? hasAnchor : must.has(n as CategoryKey))).slice(0, ROUTINE_MAX_STOPS);
  return ['home', ...middle, 'home'];
}

export function routineLabel(node: RoutineNode): string {
  if (node === 'home') return 'HOME';
  if (node === 'anchor') return 'WORK';
  return CATEGORIES[node].short.toUpperCase();
}
