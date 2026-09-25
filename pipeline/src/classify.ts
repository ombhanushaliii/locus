import { CATEGORIES, CATEGORY_KEYS, LARGE_FORMAT, SUPERMARKET_NAME_RE, type CategoryKey } from '@locus/shared';
import { q } from './duck.js';

/**
 * Turn the taxonomy into DuckDB expressions so 100k+ places are classified
 * inside the database instead of round-tripping through Node.
 */

function list(values: readonly string[]): string {
  return `[${values.map(q).join(', ')}]`;
}

/** Boolean SQL: does this Overture row belong to `key`? Expects columns category, hierarchy, brand, name. */
export function overtureMatchSql(key: CategoryKey): string {
  const c = CATEGORIES[key];
  const hits: string[] = [];
  if (c.primary?.length) hits.push(`category IN (${c.primary.map(q).join(', ')})`);
  if (c.subtree?.length) hits.push(`list_has_any(coalesce(hierarchy, [category]), ${list(c.subtree)})`);
  if (!hits.length) return 'false';
  let expr = `(${hits.join(' OR ')})`;
  if (c.exclude?.length) expr += ` AND NOT list_has_any(coalesce(hierarchy, [category]), ${list(c.exclude)})`;
  if (c.gate === 'branded_or_large_format') {
    expr += ` AND (category IN (${LARGE_FORMAT.map(q).join(', ')}) OR regexp_matches(coalesce(brand, '') || ' ' || name, ${q(SUPERMARKET_NAME_RE.source)}, 'i'))`;
  }
  return expr;
}

/** SELECT fragment adding one boolean column per category (k_<key>) for Overture rows. */
export function overtureKeyColumnsSql(): string {
  return CATEGORY_KEYS.map((k) => `${overtureMatchSql(k)} AS k_${k}`).join(',\n       ');
}

/* OSM tag filters `[k]`, `[k=v]`, `[k~"re"]` (chained = AND) -> SQL over a MAP column `tags`. */
const FILTER_RE = /\[([\w:]+)(?:(=|~)"?([^"\]]+)"?)?\]/g;

function osmFilterSql(filter: string): string {
  const parts = [...filter.matchAll(FILTER_RE)].map(([, key, op, value]) => {
    const col = `tags[${q(key!)}]`;
    if (!op) return `${col} IS NOT NULL`;
    if (op === '=') return `${col} = ${q(value!)}`;
    return `regexp_matches(coalesce(${col}, ''), ${q(value!)})`;
  });
  if (!parts.length) throw new Error(`Unsupported OSM filter: ${filter}`);
  return `(${parts.join(' AND ')})`;
}

/** Boolean SQL: does this OSM element (MAP column `tags`) belong to `key`? */
export function osmMatchSql(key: CategoryKey): string {
  const filters = CATEGORIES[key].osm;
  if (!filters?.length) return 'false';
  return `(${filters.map(osmFilterSql).join(' OR ')})`;
}

export function osmKeyColumnsSql(): string {
  return CATEGORY_KEYS.map((k) => `${osmMatchSql(k)} AS k_${k}`).join(',\n       ');
}

/** `keys` list column built from the k_* booleans. */
export function keysListSql(): string {
  return `list_filter([${CATEGORY_KEYS.map((k) => `CASE WHEN k_${k} THEN ${q(k)} END`).join(', ')}], x -> x IS NOT NULL)`;
}

/** WHERE fragment: any k_* true. */
export function anyKeySql(): string {
  return `(${CATEGORY_KEYS.map((k) => `k_${k}`).join(' OR ')})`;
}
