import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, schema } from '@locus/server/db';
import { geocode } from '@locus/server/google';

interface SeedFile {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  airport: { query: string; label: string };
  localities: { name: string; subRegion?: string; character?: string }[];
}

const SEEDS = path.resolve(import.meta.dirname, '../seeds');

async function main() {
  const db = getDb();
  const files = readdirSync(SEEDS).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const seed = JSON.parse(readFileSync(path.join(SEEDS, file), 'utf8')) as SeedFile;
    const airport = await geocode(seed.airport.query);
    if (!airport) throw new Error(`Could not geocode airport for ${seed.id}: ${seed.airport.query}`);

    await db
      .insert(schema.cities)
      .values({
        id: seed.id,
        name: seed.name,
        centerLat: seed.center.lat,
        centerLng: seed.center.lng,
        airportLat: airport.location.lat,
        airportLng: airport.location.lng,
        airportLabel: seed.airport.label,
      })
      .onConflictDoUpdate({
        target: schema.cities.id,
        set: { name: seed.name, centerLat: seed.center.lat, centerLng: seed.center.lng, airportLat: airport.location.lat, airportLng: airport.location.lng, airportLabel: seed.airport.label },
      });

    for (const l of seed.localities) {
      await db
        .insert(schema.localities)
        .values({ cityId: seed.id, name: l.name, subRegion: l.subRegion ?? null, character: l.character ?? null })
        .onConflictDoUpdate({
          target: [schema.localities.cityId, schema.localities.name],
          set: { subRegion: l.subRegion ?? null, character: l.character ?? null },
        });
    }
    console.log(`${seed.name}: ${seed.localities.length} localities, airport ${seed.airport.label} at ${airport.location.lat.toFixed(4)},${airport.location.lng.toFixed(4)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
