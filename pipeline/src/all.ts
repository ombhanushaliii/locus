import { existsSync } from 'node:fs';
import { CITIES } from './config.js';
import { openDuck } from './duck.js';
import { extractCity } from './extract.js';
import { extractOsm, pbfFor } from './osm.js';
import { buildCity } from './build.js';

/** npm run all -w pipeline [--force] [--build-only] [--only a,b,c] : every configured city, then index. */
async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1]?.split(',')) : null;
  const duck = await openDuck();
  const pbf = (() => {
    try {
      return pbfFor();
    } catch {
      return null;
    }
  })();
  for (const city of CITIES) {
    if (only && !only.has(city.id)) continue;
    const t = Date.now();
    console.log(`\n${city.name}`);
    try {
      if (!args.includes('--build-only')) {
        await extractCity(duck, city, { force: args.includes('--force') });
        if (pbf && existsSync(pbf)) await extractOsm(duck, city, pbf, args.includes('--force'));
      }
      const r = await buildCity(duck, city);
      console.log(`  ${r.localities} localities, ${r.pois} places in ${((Date.now() - t) / 1000).toFixed(0)} s`);
    } catch (e) {
      console.error(`  FAILED: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  duck.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
