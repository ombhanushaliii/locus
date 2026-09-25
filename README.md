# Locus

Find the locality in a new Indian city that best preserves the day-to-day life you have now.

Live at **trylocus.pages.dev** (Cloudflare Pages). Design and product thinking: `PLAN.md`.

## How it works

Everything is static. A monthly pipeline turns open data into one small dataset per city; the site loads the
two cities involved in a move and does the rest in the browser — no API keys, no servers, nothing live.

```
pipeline/   DuckDB over Overture Maps + OpenStreetMap  →  data/cities/<id>/{meta,localities,pois}.json + data/index.json
shared/     taxonomy (25 everyday categories), scoring, routine, character lines, the matching engine, tests
client/     Vite + React, MapLibre on OpenFreeMap tiles repainted to the atlas palette, loads /data/*
```

1. **Where you live now** — search any locality in a covered city (index of every derived locality).
2. **Your current setup** — every named place within reach of that locality, grouped by what a week is made of;
   mark must / nice / skip, remove what isn't yours. The must-haves become your routine.
3. **The match** — the destination's localities are scored against your setup; the top three are shown with
   an honest verdict, a data-derived character line, your routine recreated, and a locality profile page.

## Run

```bash
npm install
npm run data       # build data/index.json and copy data into client/public/data (needs built cities, see below)
npm run dev        # http://localhost:5173
npm test           # shared engine tests
npm run typecheck
npm run build      # client/dist, ready for Cloudflare Pages
```

## Data

```bash
# once: an OSM extract in data/osm/ (india-latest covers all cities; western-zone is enough for Maharashtra/Gujarat/Goa)
curl -L -o data/osm/india-latest.osm.pbf https://download.geofabrik.de/asia/india-latest.osm.pbf

npm run city -w pipeline -- pune         # one city: extract (cached) + build   ~3 min first time, seconds after
npm run all  -w pipeline                 # every city in pipeline/src/config.ts
npm run data                             # index + sync to the client
```

Sources: Overture Maps places and divisions (CC-BY / ODbL), OpenStreetMap (ODbL) for transit, parks, worship
and place names, OpenFreeMap tiles. Localities are derived from the data — division points, OSM place nodes,
and the addresses of the places themselves — never typed by hand. Details in `pipeline/README.md`.

## Deploy

`wrangler.toml` names the Cloudflare Pages project `trylocus`. First time: `npx wrangler login`, then

```bash
npm run deploy     # builds the client and publishes client/dist as trylocus.pages.dev
```

`client/public/_redirects` routes every path to the SPA. Data files ship inside the build.
