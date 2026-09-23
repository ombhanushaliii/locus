import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  airportPlaceId: text('airport_place_id').notNull(),
  airportLabel: text('airport_label').notNull(),
});

export const localities = pgTable('localities', {
  id: serial('id').primaryKey(),
  cityId: text('city_id')
    .notNull()
    .references(() => cities.id),
  name: text('name').notNull(),
  subRegion: text('sub_region'),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  vpSwLat: doublePrecision('vp_sw_lat').notNull(),
  vpSwLng: doublePrecision('vp_sw_lng').notNull(),
  vpNeLat: doublePrecision('vp_ne_lat').notNull(),
  vpNeLng: doublePrecision('vp_ne_lng').notNull(),
  housingCount: integer('housing_count').notNull().default(0),
  isResidential: boolean('is_residential').notNull().default(false),
  scannedAt: timestamp('scanned_at', { withTimezone: true }),
});

export type StoredPoint = { placeId: string; lat: number; lng: number };

export const localityAmenityCounts = pgTable(
  'locality_amenity_counts',
  {
    localityId: integer('locality_id')
      .notNull()
      .references(() => localities.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    count: integer('count').notNull(),
    placeIds: text('place_ids').array().notNull().default([]),
    points: jsonb('points').$type<StoredPoint[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.localityId, t.category] })],
);
