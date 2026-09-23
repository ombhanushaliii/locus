# Locus

Find the locality in a new Indian city that best preserves the day-to-day life you have now.
Design and architecture: see `PLAN.md`.

## Run

```bash
npm install
npm run dev        # client http://localhost:5173, API http://localhost:3001
npm test           # shared scoring + routine tests
npm run typecheck
```

Without a Google Maps browser key the client runs in **mock mode**: the whole flow works on
deterministic sample data (Bandra West, Indiranagar, Lonavala → Pune / Mumbai / Bengaluru / Delhi NCR)
and the map is the SVG "paper map". Shortcuts while in mock mode:

- `/?demo=setup` — Bandra West → Pune, on the "Your current setup" screen
- `/?demo=match` — same pair, straight into the translation and the match
- `/?demo=anchor` — same, with a work anchor in Hinjewadi
- `/?demo=locality` — the Aundh profile page

## Environment

Copy `.env.example` to `.env`. The server reads it if present; the client needs `VITE_`-prefixed copies of the browser key and map ID (`VITE_GOOGLE_MAPS_BROWSER_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`). Setting the browser key turns mock mode off.

## Layout

```
/client   Vite + React      src/atlas (tokens, glyphs, map style) · src/pages · src/components
/server   Express + Drizzle src/db/schema.ts · src/index.ts
/shared   taxonomy, scoring, routine derivation, API types
/scripts  seed + scan CLI (M1)
```
