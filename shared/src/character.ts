import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from './categories.js';
import type { LocalityRecord } from './types.js';

/**
 * A one-line character for a locality, derived from how its counts compare with
 * the rest of the city: "Dense with cafés and nightlife; light on parks."
 */

const STRONG_RATIO = 1.6;
const LIGHT_RATIO = 0.45;

const NOUN: Partial<Record<CategoryKey, string>> = {
  grocery: 'kirana stores',
  supermarket: 'supermarkets',
  pharmacy: 'pharmacies',
  bank: 'banks',
  salon: 'salons',
  clinic: 'clinics',
  hospital: 'hospitals',
  gym: 'gyms',
  yoga: 'yoga studios',
  park: 'parks',
  cafe: 'cafés',
  restaurant: 'restaurants',
  bakery: 'bakeries',
  nightlife: 'nightlife',
  rail: 'rail and metro',
  bus: 'bus stops',
  fuel: 'fuel stations',
  preschool: 'preschools',
  school: 'schools',
  college: 'colleges',
  cinema: 'cinemas',
  mall: 'malls',
  worship: 'temples and churches',
  coworking: 'coworking',
  pet: 'vets',
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function cityMedians(localities: readonly LocalityRecord[]): Record<CategoryKey, number> {
  const primary = localities.filter((l) => l.tier === 'primary');
  return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, Math.max(1, median(primary.map((l) => l.counts[k] ?? 0)))])) as Record<CategoryKey, number>;
}

function joinTwo(a: string[]): string {
  return a.length === 1 ? a[0]! : `${a[0]} and ${a[1]}`;
}

export function characterLine(l: LocalityRecord, medians: Record<CategoryKey, number>): string {
  const ratios = CATEGORY_KEYS.map((k) => ({ k, r: (l.counts[k] ?? 0) / medians[k] }));
  const strong = ratios
    .filter((x) => x.r >= STRONG_RATIO && (l.counts[x.k] ?? 0) >= 3)
    .sort((a, b) => b.r - a.r)
    .slice(0, 2)
    .map((x) => NOUN[x.k] ?? CATEGORIES[x.k].label.toLowerCase());
  // Only call a place light on something the city broadly has.
  const light = ratios
    .filter((x) => x.r <= LIGHT_RATIO && medians[x.k] >= 3)
    .sort((a, b) => a.r - b.r)
    .slice(0, 1)
    .map((x) => NOUN[x.k] ?? CATEGORIES[x.k].label.toLowerCase());

  const dense = l.density > 3500 ? 'Dense' : l.density > 1500 ? 'Busy' : 'Quiet';
  if (strong.length && light.length) return `${dense}, with more ${joinTwo(strong)} than most of the city; light on ${light[0]}.`;
  if (strong.length) return `${dense}, with more ${joinTwo(strong)} than most of the city.`;
  if (light.length) return `${dense} and even-handed, but light on ${light[0]}.`;
  return `${dense}, with an even mix of everyday places.`;
}
