# Locus data pipeline

Builds each city's dataset offline from free, open sources. No API keys, no rate limits, nothing live.

| Layer | Source | How |
|---|---|---|
| Places (named, categorised) | Overture Maps `places` (Meta + Microsoft + OSM, CC-BY/ODbL) | DuckDB reads the public Parquet on S3 with a bbox pushdown |
| Locality names | Overture `divisions` points + OSM `place=*` nodes/areas + the places' own addresses | merged, de-duplicated, ranked by density |
| Transit, parks, worship | OSM (Geofabrik `.osm.pbf`) | DuckDB `st_readosm`, ways get centroids from their nodes |
| Buildings (optional) | Overture `buildings` (incl. Google Open Buildings) | per-hex counts; slow (~18 min/city), off by default |

```bash
# once: an OSM extract in data/osm/ (western-zone covers Maharashtra, Gujarat, Goa; india-latest covers all)
curl -L -o data/osm/india-latest.osm.pbf https://download.geofabrik.de/asia/india-latest.osm.pbf

npm run city -w pipeline -- pune              # extract (cached) + build  ->  data/cities/pune/
npm run city -w pipeline -- pune --build-only # re-derive from cached raw layers (seconds)
npm run city -w pipeline -- pune --force      # re-pull Overture + OSM
npm run osm  -w pipeline -- pune              # just the OSM layer
```

Outputs per city:

- `meta.json` — city, bbox, airport (found in the data), category keys and reach radii, counts, sources
- `localities.json` — `{ id, name, tier, kind, center, density, support?, counts{key}, nearest{key: poiIds} }`
- `pois.json` — `{ id, name, brand?, conf, lat, lng, src?, keys[] }` for every place that counts somewhere
- `raw/` — cached Parquet layers (ignored by git)

Taxonomy lives in `src/taxonomy.ts`: 25 categories a week is actually made of, each mapped to Overture
categories (primary / subtree / exclusions / a gate for supermarkets) and OSM tag filters, with a reach
(walk 800 m · ride 2 km · drive 3 km). OSM is preferred for metro/rail, bus and parks; Overture's
`bus_station` is ignored (it is full of banks in India).

How localities are derived (`src/build.ts`): candidates from the three name sources → drop anything with
fewer than 40 places within 1 km → promote busy society-level names when nothing bigger is near → dedupe
same/similar names within 1.2–1.5 km and anything within 250 m, keeping the busiest → count places per
category within reach and keep the 8 nearest ids per category for drawing routines.
