import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { OVERTURE_BASE, bboxSql, q, type Duck } from './duck.js';
import { cityBbox, cityDir, type CityConfig } from './config.js';

/**
 * Pull the Overture layers we need for one city into local Parquet files.
 * Remote scans are the slow part (metadata over hundreds of files), so each
 * layer is cached and skipped on later runs unless --force.
 */

export interface ExtractResult {
  places: string;
  divisions: string;
  buildings: string | null;
}

async function step(duck: Duck, label: string, file: string, sql: string, force: boolean): Promise<void> {
  if (existsSync(file) && !force) {
    console.log(`  ${label}: cached`);
    return;
  }
  const t = Date.now();
  await duck.run(`COPY (${sql}) TO ${q(file)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
  const { n } = await duck.one<{ n: number }>(`SELECT count(*) AS n FROM ${q(file)}`);
  console.log(`  ${label}: ${n} rows in ${((Date.now() - t) / 1000).toFixed(0)} s`);
}

export async function extractCity(duck: Duck, city: CityConfig, opts: { force?: boolean; buildings?: boolean } = {}): Promise<ExtractResult> {
  const dir = path.join(cityDir(city), 'raw');
  mkdirSync(dir, { recursive: true });
  const where = bboxSql(cityBbox(city));
  const out: ExtractResult = {
    places: path.join(dir, 'places.parquet'),
    divisions: path.join(dir, 'divisions.parquet'),
    buildings: opts.buildings ? path.join(dir, 'buildings_h9.parquet') : null,
  };

  await step(
    duck,
    'places',
    out.places,
    `SELECT id, names.primary AS name, taxonomy.primary AS category, taxonomy.hierarchy AS hierarchy, taxonomy.alternates AS alternates,
            brand.names.primary AS brand, confidence, operating_status, addresses[1].freeform AS addr,
            ST_Y(geometry) AS lat, ST_X(geometry) AS lng, h3_latlng_to_cell(ST_Y(geometry), ST_X(geometry), 9) AS h9
     FROM read_parquet('${OVERTURE_BASE}/theme=places/type=place/*', hive_partitioning=1)
     WHERE ${where} AND names.primary IS NOT NULL`,
    opts.force ?? false,
  );

  await step(
    duck,
    'divisions',
    out.divisions,
    `SELECT id, subtype, class, names.primary AS name, population, ST_Y(geometry) AS lat, ST_X(geometry) AS lng
     FROM read_parquet('${OVERTURE_BASE}/theme=divisions/type=division/*', hive_partitioning=1)
     WHERE ${where} AND subtype IN ('neighborhood','macrohood','microhood','locality','localadmin','borough')`,
    opts.force ?? false,
  );

  if (out.buildings) {
    await step(
      duck,
      'buildings (hex counts)',
      out.buildings,
      `SELECT h3_latlng_to_cell(ST_Y(ST_Centroid(geometry)), ST_X(ST_Centroid(geometry)), 9) AS h9,
              count(*) AS buildings,
              count(*) FILTER (WHERE subtype = 'residential') AS residential
       FROM read_parquet('${OVERTURE_BASE}/theme=buildings/type=building/*', hive_partitioning=1)
       WHERE ${where}
       GROUP BY 1`,
      opts.force ?? false,
    );
  }
  return out;
}
