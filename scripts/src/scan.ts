import { and, eq, isNull } from 'drizzle-orm';
import { CATEGORY_KEYS, HOUSING_KEY, RESIDENTIAL_MIN_HOUSING, metersBetween, type Viewport } from '@locus/shared';
import { getDb, schema } from '@locus/server/db';
import { geocode } from '@locus/server/google';
import { scanAround } from '@locus/server/scan';

/**
 * npm run scan -- <cityId|all> [--force] [--only "Name"]
 * Geocodes each locality, counts amenities per category around its center, upserts.
 * Skips already-scanned localities unless --force.
 */

const MAX_VIEWPORT_DIAGONAL_M = 8000;
const FALLBACK_HALF_DEG = { lat: 0.011, lng: 0.012 };

function saneViewport(center: { lat: number; lng: number }, vp: Viewport): Viewport {
  if (metersBetween(vp.sw, vp.ne) <= MAX_VIEWPORT_DIAGONAL_M) return vp;
  return {
    sw: { lat: center.lat - FALLBACK_HALF_DEG.lat, lng: center.lng - FALLBACK_HALF_DEG.lng },
    ne: { lat: center.lat + FALLBACK_HALF_DEG.lat, lng: center.lng + FALLBACK_HALF_DEG.lng },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--')) ?? 'all';
  const force = args.includes('--force');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

  const db = getDb();
  const cities = target === 'all' ? await db.select().from(schema.cities) : await db.select().from(schema.cities).where(eq(schema.cities.id, target));
  if (cities.length === 0) throw new Error(`No city '${target}'. Run npm run seed first.`);

  let calls = 0;
  for (const city of cities) {
    const where = force ? eq(schema.localities.cityId, city.id) : and(eq(schema.localities.cityId, city.id), isNull(schema.localities.scannedAt));
    let locs = await db.select().from(schema.localities).where(where);
    if (only) locs = locs.filter((l) => l.name.toLowerCase() === only.toLowerCase());
    console.log(`\n${city.name}: ${locs.length} to scan`);

    for (const l of locs) {
      const query = `${l.name}, ${l.subRegion ?? city.name}, India`;
      const geo = await geocode(query);
      calls += 1;
      if (!geo) {
        console.warn(`  ! ${l.name}: geocode failed (${query})`);
        continue;
      }
      // Guard against Geocoding snapping to the city centroid for unknown names.
      if (metersBetween(geo.location, { lat: city.centerLat, lng: city.centerLng }) > 60_000) {
        console.warn(`  ! ${l.name}: geocoded >60 km from ${city.name}, skipping`);
        continue;
      }
      const vp = saneViewport(geo.location, geo.viewport);
      const scan = await scanAround(geo.location, true);
      calls += CATEGORY_KEYS.length + 1;
      const housing = scan[HOUSING_KEY].count;

      await db
        .update(schema.localities)
        .set({
          centerLat: geo.location.lat,
          centerLng: geo.location.lng,
          vpSwLat: vp.sw.lat,
          vpSwLng: vp.sw.lng,
          vpNeLat: vp.ne.lat,
          vpNeLng: vp.ne.lng,
          housingCount: housing,
          isResidential: housing >= RESIDENTIAL_MIN_HOUSING,
          scannedAt: new Date(),
        })
        .where(eq(schema.localities.id, l.id));

      for (const k of CATEGORY_KEYS) {
        const s = scan[k];
        const row = {
          localityId: l.id,
          category: k,
          count: s.count,
          placeIds: s.places.map((p) => p.id),
          points: s.places.map((p) => ({ placeId: p.id, lat: p.location.lat, lng: p.location.lng })),
        };
        await db
          .insert(schema.localityAmenityCounts)
          .values(row)
          .onConflictDoUpdate({ target: [schema.localityAmenityCounts.localityId, schema.localityAmenityCounts.category], set: row });
      }

      const summary = CATEGORY_KEYS.map((k) => `${k.slice(0, 4)}=${scan[k].count}`).join(' ');
      console.log(`  ${housing >= RESIDENTIAL_MIN_HOUSING ? '•' : '·'} ${l.name.padEnd(22)} housing=${String(housing).padStart(2)}  ${summary}`);
    }
  }
  console.log(`\nDone. ~${calls} Google calls.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
