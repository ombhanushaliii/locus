import { sql } from 'drizzle-orm';
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const cities = sqliteTable('cities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  centerLat: real('center_lat').notNull(),
  centerLng: real('center_lng').notNull(),
  airportLat: real('airport_lat').notNull(),
  airportLng: real('airport_lng').notNull(),
  airportLabel: text('airport_label').notNull(),
});

export const localities = sqliteTable(
  'localities',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cityId: text('city_id')
      .notNull()
      .references(() => cities.id),
    name: text('name').notNull(),
    subRegion: text('sub_region'),
    character: text('character'),
    // Geometry is null until `scan` has geocoded the locality.
    centerLat: real('center_lat'),
    centerLng: real('center_lng'),
    vpSwLat: real('vp_sw_lat'),
    vpSwLng: real('vp_sw_lng'),
    vpNeLat: real('vp_ne_lat'),
    vpNeLng: real('vp_ne_lng'),
    housingCount: integer('housing_count').notNull().default(0),
    isResidential: integer('is_residential', { mode: 'boolean' }).notNull().default(false),
    scannedAt: integer('scanned_at', { mode: 'timestamp' }),
  },
  (t) => [uniqueIndex('localities_city_name').on(t.cityId, t.name)],
);

export type StoredPoint = { placeId: string; lat: number; lng: number };

export const localityAmenityCounts = sqliteTable(
  'locality_amenity_counts',
  {
    localityId: integer('locality_id')
      .notNull()
      .references(() => localities.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    count: integer('count').notNull(),
    placeIds: text('place_ids', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    points: text('points', { mode: 'json' }).$type<StoredPoint[]>().notNull().default(sql`'[]'`),
  },
  (t) => [primaryKey({ columns: [t.localityId, t.category] })],
);
