/**
 * Locus taxonomy v2: what a person's week is actually made of.
 * Each category maps to Overture place categories (dense, named) and OSM tags
 * (transit, parks, worship). The pipeline classifies places with these rules;
 * the app uses labels, glyphs, reach and defaults.
 */

export const CATEGORY_KEYS = [
  'grocery',
  'supermarket',
  'pharmacy',
  'bank',
  'salon',
  'clinic',
  'hospital',
  'gym',
  'yoga',
  'park',
  'cafe',
  'restaurant',
  'bakery',
  'nightlife',
  'rail',
  'bus',
  'fuel',
  'preschool',
  'school',
  'college',
  'cinema',
  'mall',
  'worship',
  'coworking',
  'pet',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type Importance = 'must' | 'nice' | 'none';

export type Reach = 'walk' | 'ride' | 'drive';

/** Reach in metres: walk 800 m, short ride 2 km, drive 3 km. */
export const REACH_M: Record<Reach, number> = { walk: 800, ride: 2000, drive: 3000 };

export type Family = 'daily' | 'health' | 'fitness' | 'food' | 'move' | 'learn' | 'out' | 'other';

export const FAMILIES: { key: Family; label: string }[] = [
  { key: 'daily', label: 'Daily errands' },
  { key: 'health', label: 'Health' },
  { key: 'fitness', label: 'Fitness & outdoors' },
  { key: 'food', label: 'Eating & drinking' },
  { key: 'move', label: 'Getting around' },
  { key: 'learn', label: 'Learning' },
  { key: 'out', label: 'Going out' },
  { key: 'other', label: 'Everything else' },
];

export type Glyph =
  | 'square'
  | 'hexagon'
  | 'cross'
  | 'cross-circle'
  | 'cross-square'
  | 'diamond'
  | 'diamond-dot'
  | 'tree'
  | 'ring'
  | 'dot'
  | 'half-circle'
  | 'crescent'
  | 'bars'
  | 'chevron'
  | 'teardrop'
  | 'triangle-small'
  | 'triangle'
  | 'triangle-base'
  | 'asterisk'
  | 'grid'
  | 'pentagon'
  | 'double-square'
  | 'quad'
  | 'rect'
  | 'x';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  /** Short form for map labels and the routine thread. */
  short: string;
  family: Family;
  reach: Reach;
  glyph: Glyph;
  defaultImportance: Importance;
  /** Overture: exact taxonomy.primary values that count. */
  primary?: readonly string[];
  /** Overture: any hierarchy element equal to one of these counts (subtree match). */
  subtree?: readonly string[];
  /** Overture: hierarchy elements that exclude a match even if subtree matched. */
  exclude?: readonly string[];
  /** Extra gate on the row for supermarkets: a big-box chain or large-format store type. */
  gate?: 'branded_or_large_format';
  /** OSM tag filters, Overpass syntax `[k=v]` / `[k~"re"]`, chained = AND. */
  osm?: readonly string[];
  /** Which source wins when both have the category; default overture. */
  prefer?: 'overture' | 'osm';
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  grocery: {
    key: 'grocery',
    label: 'Daily groceries',
    short: 'Groceries',
    family: 'daily',
    reach: 'walk',
    glyph: 'square',
    defaultImportance: 'must',
    primary: ['grocery_store', 'convenience_store', 'butcher_shop', 'dairy_store', 'farmers_market', 'fruits_and_vegetables_store', 'general_store', 'kirana_store', 'supermarket'],
    osm: ['[shop~"^(supermarket|convenience|grocery|greengrocer|general|dairy|butcher)$"]'],
  },
  supermarket: {
    key: 'supermarket',
    label: 'Supermarkets & big stores',
    short: 'Supermarket',
    family: 'daily',
    reach: 'drive',
    glyph: 'hexagon',
    defaultImportance: 'nice',
    // department_store is apparel in India (Shoppers Stop, Lifestyle) so it does not count.
    primary: ['grocery_store', 'supermarket', 'hypermarket', 'discount_store', 'wholesale_store'],
    gate: 'branded_or_large_format',
  },
  pharmacy: { key: 'pharmacy', label: 'Pharmacies', short: 'Pharmacy', family: 'daily', reach: 'walk', glyph: 'cross', defaultImportance: 'must', primary: ['pharmacy'], osm: ['[amenity=pharmacy]'] },
  bank: { key: 'bank', label: 'Banks & ATMs', short: 'Bank/ATM', family: 'daily', reach: 'walk', glyph: 'rect', defaultImportance: 'nice', primary: ['bank', 'bank_or_credit_union', 'atm'], osm: ['[amenity~"^(bank|atm)$"]'] },
  salon: { key: 'salon', label: 'Salons & barbers', short: 'Salon', family: 'daily', reach: 'walk', glyph: 'x', defaultImportance: 'nice', subtree: ['beauty_salon', 'hair_salon', 'barber_shop', 'nail_salon', 'spa'], osm: ['[shop~"^(hairdresser|beauty)$"]'] },
  clinic: {
    key: 'clinic',
    label: 'Clinics & doctors',
    short: 'Clinics',
    family: 'health',
    reach: 'ride',
    glyph: 'cross-circle',
    defaultImportance: 'nice',
    subtree: ['doctors_office', 'dental_clinic', 'clinic', 'medical_clinic', 'pediatric_clinic', 'physiotherapy', 'diagnostics_imaging_or_lab_service'],
    osm: ['[amenity~"^(clinic|doctors|dentist)$"]', '[healthcare~"^(clinic|doctor|dentist|laboratory)$"]'],
  },
  hospital: { key: 'hospital', label: 'Hospitals', short: 'Hospitals', family: 'health', reach: 'drive', glyph: 'cross-square', defaultImportance: 'nice', primary: ['hospital'], osm: ['[amenity=hospital]'] },
  gym: {
    key: 'gym',
    label: 'Gyms',
    short: 'Gym',
    family: 'fitness',
    reach: 'ride',
    glyph: 'diamond',
    defaultImportance: 'nice',
    subtree: ['gym', 'fitness_center', 'crossfit_gym', 'sport_or_fitness_facility', 'martial_arts_club', 'boxing_gym', 'gymnastics_center', 'swimming_pool'],
    exclude: ['yoga_studio', 'pilates_studio', 'fitness_trainer', 'dance_studio', 'pool_billiards', 'race_track', 'golf_course', 'soccer_field', 'badminton_court', 'tennis_court', 'cricket_ground', 'stadium_arena', 'bowling_alley', 'shooting_range'],
    osm: ['[leisure~"^(fitness_centre|sports_centre|swimming_pool)$"]'],
  },
  yoga: { key: 'yoga', label: 'Yoga & meditation', short: 'Yoga', family: 'fitness', reach: 'ride', glyph: 'diamond-dot', defaultImportance: 'none', subtree: ['yoga_studio', 'pilates_studio', 'meditation_center'] },
  park: {
    key: 'park',
    label: 'Parks & gardens',
    short: 'Parks',
    family: 'fitness',
    reach: 'walk',
    glyph: 'tree',
    defaultImportance: 'nice',
    subtree: ['park', 'garden', 'playground', 'dog_park', 'nature_preserve'],
    exclude: ['water_park', 'amusement_park', 'theme_park', 'rv_park', 'trailer_park', 'skate_park'],
    osm: ['[leisure~"^(park|garden|playground)$"]'],
    prefer: 'osm',
  },
  cafe: { key: 'cafe', label: 'Cafés', short: 'Cafés', family: 'food', reach: 'walk', glyph: 'ring', defaultImportance: 'nice', subtree: ['cafe', 'coffee_shop', 'tea_house', 'juice_bar', 'bubble_tea'], osm: ['[amenity=cafe]'] },
  restaurant: {
    key: 'restaurant',
    label: 'Restaurants',
    short: 'Eating out',
    family: 'food',
    reach: 'walk',
    glyph: 'dot',
    defaultImportance: 'must',
    subtree: ['restaurant', 'fast_food_restaurant', 'casual_eatery', 'food_court', 'street_food_vendor'],
    exclude: ['cafe', 'coffee_shop', 'bakery'],
    osm: ['[amenity~"^(restaurant|fast_food|food_court)$"]'],
  },
  bakery: { key: 'bakery', label: 'Bakeries & sweets', short: 'Bakery', family: 'food', reach: 'walk', glyph: 'half-circle', defaultImportance: 'nice', subtree: ['bakery', 'dessert_shop', 'sweet_shop', 'ice_cream_shop', 'sweets_and_desserts'], osm: ['[shop~"^(bakery|confectionery|pastry)$"]'] },
  nightlife: { key: 'nightlife', label: 'Bars & nightlife', short: 'Nightlife', family: 'food', reach: 'ride', glyph: 'crescent', defaultImportance: 'none', subtree: ['bar', 'pub', 'lounge', 'wine_bar', 'night_club', 'dance_club', 'brewery', 'nightlife_venue'], osm: ['[amenity~"^(bar|pub|nightclub)$"]'] },
  rail: {
    key: 'rail',
    label: 'Metro & rail stations',
    short: 'Metro/rail',
    family: 'move',
    reach: 'ride',
    glyph: 'bars',
    defaultImportance: 'nice',
    primary: ['train_station', 'metro_station', 'light_rail_station', 'subway_station'],
    osm: ['[railway~"^(station|halt)$"]', '[station=subway]', '[public_transport=station][train=yes]', '[public_transport=station][subway=yes]'],
    prefer: 'osm',
  },
  bus: {
    key: 'bus',
    label: 'Bus stops & stations',
    short: 'Bus',
    family: 'move',
    reach: 'walk',
    glyph: 'chevron',
    defaultImportance: 'nice',
    // Overture's bus_station is polluted (banks, petrol pumps) in India; OSM only.
    osm: ['[highway=bus_stop]', '[amenity=bus_station]', '[public_transport=platform][bus=yes]'],
    prefer: 'osm',
  },
  fuel: { key: 'fuel', label: 'Fuel stations', short: 'Fuel', family: 'move', reach: 'ride', glyph: 'teardrop', defaultImportance: 'none', primary: ['gas_station', 'ev_charging_station'], osm: ['[amenity~"^(fuel|charging_station)$"]'] },
  preschool: { key: 'preschool', label: 'Preschools & daycare', short: 'Preschool', family: 'learn', reach: 'walk', glyph: 'triangle-small', defaultImportance: 'none', subtree: ['preschool', 'day_care_preschool', 'child_care_and_day_care'], osm: ['[amenity~"^(kindergarten|childcare)$"]'] },
  school: {
    key: 'school',
    label: 'Schools',
    short: 'Schools',
    family: 'learn',
    reach: 'ride',
    glyph: 'triangle',
    defaultImportance: 'nice',
    subtree: ['school'],
    exclude: ['preschool', 'day_care_preschool', 'specialty_school', 'driving_school', 'music_school', 'language_school', 'cooking_school', 'art_school', 'cosmetology_school', 'flight_school', 'medical_school'],
    osm: ['[amenity=school]'],
  },
  college: { key: 'college', label: 'Colleges & universities', short: 'College', family: 'learn', reach: 'drive', glyph: 'triangle-base', defaultImportance: 'none', primary: ['college_university'], osm: ['[amenity~"^(college|university)$"]'] },
  cinema: { key: 'cinema', label: 'Cinemas', short: 'Cinema', family: 'out', reach: 'drive', glyph: 'asterisk', defaultImportance: 'nice', primary: ['movie_theater'], osm: ['[amenity=cinema]'] },
  mall: { key: 'mall', label: 'Malls', short: 'Malls', family: 'out', reach: 'drive', glyph: 'grid', defaultImportance: 'nice', primary: ['shopping_mall', 'shopping_center'], osm: ['[shop=mall]'] },
  worship: {
    key: 'worship',
    label: 'Places of worship',
    short: 'Worship',
    family: 'other',
    reach: 'walk',
    glyph: 'pentagon',
    defaultImportance: 'none',
    subtree: ['hindu_place_of_worship', 'muslim_place_of_worship', 'christian_place_of_worship', 'sikh_place_of_worship', 'buddhist_place_of_worship', 'jain_place_of_worship', 'place_of_worship', 'religious_organization'],
    osm: ['[amenity=place_of_worship]'],
  },
  coworking: { key: 'coworking', label: 'Coworking spaces', short: 'Coworking', family: 'other', reach: 'ride', glyph: 'double-square', defaultImportance: 'none', primary: ['coworking_space', 'shared_office_space'], osm: ['[amenity=coworking_space]', '[office=coworking]'] },
  pet: { key: 'pet', label: 'Vets & pet stores', short: 'Pets', family: 'other', reach: 'ride', glyph: 'quad', defaultImportance: 'none', subtree: ['veterinarian', 'pet_store', 'pet_groomer', 'pet_services'], osm: ['[amenity=veterinary]', '[shop=pet]'] },
};

export const CATEGORY_LIST: readonly CategoryDef[] = CATEGORY_KEYS.map((k) => CATEGORIES[k]);

export function reachM(key: CategoryKey): number {
  return REACH_M[CATEGORIES[key].reach];
}

/** Categories grouped by family, in ledger order. */
export function byFamily(): { family: Family; label: string; keys: CategoryKey[] }[] {
  return FAMILIES.map((f) => ({ family: f.key, label: f.label, keys: CATEGORY_KEYS.filter((k) => CATEGORIES[k].family === f.key) }));
}

/** Big-box grocery chains common in India; matched against brand + name for the supermarket gate. */
export const SUPERMARKET_NAME_RE =
  /\b(d ?mart|dmart|reliance (fresh|smart|mart)|smart bazaar|jio ?mart|big ?bazaar|more (supermarket|megastore|hypermarket|retail)|star bazaar|spencer'?s|nature'?s basket|vishal mega ?mart|ratnadeep|metro cash|walmart|best price|hypercity|easyday|heritage fresh|nilgiris|foodhall|lulu|supermarket|super market|hypermarket|hyper market)\b/i;

export const LARGE_FORMAT: readonly string[] = ['discount_store', 'wholesale_store', 'hypermarket', 'supermarket'];
