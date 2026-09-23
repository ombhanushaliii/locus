import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as schema from './schema.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const MIGRATIONS = path.resolve(import.meta.dirname, '../../drizzle');

export const DB_FILE = path.resolve(REPO_ROOT, process.env.DATABASE_FILE ?? 'data/locus.db');

function open() {
  mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const client = new Database(DB_FILE);
  client.pragma('journal_mode = WAL');
  client.pragma('foreign_keys = ON');
  const db = drizzle({ client, schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

let instance: ReturnType<typeof open> | undefined;

export function getDb() {
  return (instance ??= open());
}

export type Db = ReturnType<typeof getDb>;
export { schema };
