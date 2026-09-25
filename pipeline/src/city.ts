import { existsSync } from 'node:fs';
import { cityById } from './config.js';
import { openDuck } from './duck.js';
import { extractCity } from './extract.js';
import { extractOsm, pbfFor } from './osm.js';
import { buildCity } from './build.js';

/**
 * npm run city -- <cityId> [--force] [--buildings] [--extract-only] [--build-only]
 *   extract: pull Overture layers into data/cities/<id>/raw/ (cached), plus OSM from a local .pbf if present
 *   build:   derive localities + classified places into data/cities/<id>/
 */
async function main() {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith('--'));
  if (!id) throw new Error('usage: npm run city -- <cityId> [--force] [--buildings] [--extract-only] [--build-only]');
  const city = cityById(id);
  const duck = await openDuck();
  console.log(`${city.name} (${city.radiusKm} km radius)`);

  if (!args.includes('--build-only')) {
    const t = Date.now();
    await extractCity(duck, city, { force: args.includes('--force'), buildings: args.includes('--buildings') });
    try {
      const pbf = pbfFor();
      if (existsSync(pbf)) await extractOsm(duck, city, pbf, args.includes('--force'));
    } catch (e) {
      console.log(`  osm: skipped (${(e as Error).message})`);
    }
    console.log(`extract done in ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
  if (!args.includes('--extract-only')) {
    const t = Date.now();
    const r = await buildCity(duck, city);
    console.log(`build done in ${((Date.now() - t) / 1000).toFixed(0)} s: ${r.localities} localities, ${r.pois} places`);
  }
  duck.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
