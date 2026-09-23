# Locus

Find the locality in a new Indian city that best preserves the day-to-day life you have now.
Design and architecture: see `PLAN.md`.

## Run

```bash
npm install
npm run dev        # client http://localhost:5173, API http://localhost:3001
npm test           # shared scoring, routine, explanation tests
npm run typecheck
```

## Environment

Copy `.env.example` to `.env` at the repo root. Both the server (`tsx --env-file`) and the client (Vite `envDir`) read it; only `GOOGLE_MAPS_BROWSER_KEY` and `GOOGLE_MAPS_MAP_ID` are exposed to the browser.

The Google Cloud project behind the keys needs these APIs enabled:

- Server key: **Geocoding API**, **Places API (New)**, **Routes API**
- Browser key: **Maps JavaScript API**

The database is a SQLite file (`DATABASE_FILE`, default `data/locus.db`), created and migrated automatically the first time the server or a script opens it.

## Mock mode

Without `GOOGLE_MAPS_BROWSER_KEY` the client runs on deterministic sample data (Bandra West, Indiranagar, Lonavala → Pune / Mumbai / Bengaluru / Delhi NCR) and draws the SVG "paper map". Force it with `VITE_MOCK=1`. Shortcuts:

- `/?demo=setup` — Bandra West → Pune, on the "Your current setup" screen
- `/?demo=match` — same pair, straight into the translation and the match
- `/?demo=anchor` — same, with a work anchor in Hinjewadi
- `/?demo=locality` — the Aundh profile page

## Precompute (real mode)

```bash
npm run seed                 # cities + locality names from scripts/seeds/*.json (geocodes the 4 airports)
npm run scan -- pune         # geocode + Nearby Search every unscanned locality in one city
npm run scan -- all          # all cities
npm run scan -- pune --force # rescan already-scanned localities
npm run scan -- pune --only "Aundh"
```

A full city is ~60 localities × 11 Nearby Search calls ≈ 650 Places calls plus ~60 Geocoding calls. Localities are stored with `place_id`s, coordinates and per-category counts only.

## Layout

```
/client   Vite + React      src/atlas (tokens, glyphs, map style) · src/pages · src/components (AtlasMap → PaperMap | GoogleAtlasMap)
/server   Express + Drizzle src/db · src/google.ts (Geocoding, Places New, Routes) · src/scan.ts · src/index.ts (API)
/shared   taxonomy, scoring, routine, explanation, geo helpers, API types
/scripts  seed + scan CLI, seeds/*.json
```
