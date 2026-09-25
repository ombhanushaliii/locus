import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';

export const OVERTURE_RELEASE = process.env.OVERTURE_RELEASE ?? '2026-09-23.0';
export const OVERTURE_BASE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}`;

export type Row = Record<string, unknown>;

export interface Duck {
  run(sql: string): Promise<void>;
  all<T extends Row = Row>(sql: string): Promise<T[]>;
  one<T extends Row = Row>(sql: string): Promise<T>;
  close(): void;
}

function plain(v: unknown): unknown {
  if (typeof v === 'bigint') return Number(v);
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    // DuckDB list/struct values expose `items` / `entries`
    const o = v as { items?: unknown[]; entries?: Record<string, unknown> };
    if (Array.isArray(o.items)) return o.items.map(plain);
    if (o.entries && typeof o.entries === 'object') return Object.fromEntries(Object.entries(o.entries).map(([k, x]) => [k, plain(x)]));
    return String(v);
  }
  return v;
}

export async function openDuck(path = ':memory:'): Promise<Duck> {
  const inst = await DuckDBInstance.create(path);
  const c: DuckDBConnection = await inst.connect();
  for (const s of ['INSTALL spatial', 'LOAD spatial', 'INSTALL httpfs', 'LOAD httpfs', 'INSTALL h3 FROM community', 'LOAD h3', "SET s3_region='us-west-2'", "SET preserve_insertion_order=false"]) {
    await c.run(s);
  }
  const all = async <T extends Row>(sql: string) => {
    const r = await c.runAndReadAll(sql);
    return r.getRowObjects().map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, plain(v)]))) as T[];
  };
  return {
    run: async (sql) => {
      await c.run(sql);
    },
    all,
    one: async <T extends Row>(sql: string) => {
      const rows = await all<T>(sql);
      if (!rows[0]) throw new Error(`No rows: ${sql.slice(0, 80)}`);
      return rows[0];
    },
    close: () => c.closeSync(),
  };
}

export function bboxSql(b: { west: number; south: number; east: number; north: number }): string {
  return `bbox.xmin BETWEEN ${b.west} AND ${b.east} AND bbox.ymin BETWEEN ${b.south} AND ${b.north}`;
}

export const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
