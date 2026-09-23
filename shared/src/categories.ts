export const CATEGORY_KEYS = [
  'grocery',
  'megastore',
  'healthcare',
  'fitness',
  'food',
  'transit',
  'education',
  'entertainment',
  'worship',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

/** Internal-only scan used for the residential filter. Never scored. */
export const HOUSING_KEY = 'housing' as const;

export type ScanKey = CategoryKey | typeof HOUSING_KEY;

export type Glyph =
  | 'square'
  | 'hexagon'
  | 'cross-circle'
  | 'diamond'
  | 'dot'
  | 'bars'
  | 'triangle'
  | 'asterisk'
  | 'half-circle';

export type Importance = 'must' | 'nice' | 'none';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  includedTypes: readonly string[];
  radiusM: number;
  glyph: Glyph;
  defaultImportance: Importance;
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  grocery: {
    key: 'grocery',
    label: 'Grocery',
    includedTypes: ['supermarket', 'grocery_store', 'convenience_store'],
    radiusM: 750,
    glyph: 'square',
    defaultImportance: 'must',
  },
  megastore: {
    key: 'megastore',
    label: 'Megastore',
    includedTypes: ['supermarket'],
    radiusM: 3000,
    glyph: 'hexagon',
    defaultImportance: 'nice',
  },
  healthcare: {
    key: 'healthcare',
    label: 'Healthcare',
    includedTypes: ['hospital', 'pharmacy', 'doctor'],
    radiusM: 2000,
    glyph: 'cross-circle',
    defaultImportance: 'must',
  },
  fitness: {
    key: 'fitness',
    label: 'Gym / fitness',
    includedTypes: ['gym', 'fitness_center'],
    radiusM: 1500,
    glyph: 'diamond',
    defaultImportance: 'nice',
  },
  food: {
    key: 'food',
    label: 'Restaurants & cafes',
    includedTypes: ['restaurant', 'cafe'],
    radiusM: 500,
    glyph: 'dot',
    defaultImportance: 'nice',
  },
  transit: {
    key: 'transit',
    label: 'Public transport',
    includedTypes: ['train_station', 'subway_station', 'bus_station'],
    radiusM: 1500,
    glyph: 'bars',
    defaultImportance: 'must',
  },
  education: {
    key: 'education',
    label: 'Education',
    includedTypes: ['school', 'university'],
    radiusM: 2000,
    glyph: 'triangle',
    defaultImportance: 'nice',
  },
  entertainment: {
    key: 'entertainment',
    label: 'Entertainment',
    includedTypes: ['movie_theater', 'shopping_mall', 'park'],
    radiusM: 3000,
    glyph: 'asterisk',
    defaultImportance: 'nice',
  },
  worship: {
    key: 'worship',
    label: 'Places of worship',
    includedTypes: ['place_of_worship', 'hindu_temple', 'mosque', 'church'],
    radiusM: 1500,
    glyph: 'half-circle',
    defaultImportance: 'none',
  },
};

export const HOUSING_TYPES = [
  'apartment_building',
  'apartment_complex',
  'condominium_complex',
  'housing_complex',
] as const;
export const HOUSING_RADIUS_M = 1500;

export const CATEGORY_LIST: readonly CategoryDef[] = CATEGORY_KEYS.map((k) => CATEGORIES[k]);
