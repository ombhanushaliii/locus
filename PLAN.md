# Locus — Implementation Plan

Find the locality in a new Indian city that best preserves the day-to-day life you have now.

> **Status (v2, after the hackathon).** The product is now static-first: an offline pipeline (`pipeline/`,
> DuckDB over Overture Maps + OpenStreetMap) derives every city's localities and named places, and the browser
> does the home scan and matching from those files. There is no server, no SQLite, no live API. The taxonomy
> grew from 9 to 25 everyday categories (`shared/src/categories.ts`). Sections 2–4.4 below describe the v1
> hackathon build and are kept for the reasoning; the current architecture is in `README.md` and
> `pipeline/README.md`. Sections 4.5–4.6 (the experience and design system) still hold.

## 1. Product scope (v1, hackathon)

- **Input**: user's current home address (anywhere in India) + a target city. Optional: one anchor address (work or college) used for commute relationships.
- **Output**: the three localities in the target city that best reproduce the user's *pattern of life* — not a list of places, but a comparison of whole living environments. Each gets a lifestyle match (0–100), a per-category ledger, a routine-preservation view, and a plain explanation derived from the ledger (what you'd keep / what changes / what you'd give up / what you'd gain). If nothing qualifies as an equivalent, say so plainly and show the closest alternative with what it lacks.
- **Target cities**: Mumbai, Pune, Bengaluru, Delhi NCR (Delhi / Gurugram / Noida, tagged by sub-region).
- **Out of scope**: rent, quality scoring beyond the Megastore gate, accounts/auth, user-data persistence, global cities.

## 2. Settled decisions

| # | Decision |
|---|---|
| Data source | OpenStreetMap, no API keys: Photon (address search + geocoding), Overpass (amenities around a point), OSRM public demo server (drive times), OpenFreeMap vector tiles (basemap). All rate-limited public services, identified with `OSM_USER_AGENT`. |
| Locality unit | Curated seed list per city (~50–60 names), forward-geocoded to center + viewport; filtered for residential-ness |
| Residential filter | `building=apartments|residential` + `landuse=residential` features within 1.5 km of center, counted server-side (`out count`, polygons never downloaded); `< 5` → flagged non-residential, excluded from ranking, kept in DB |
| Baseline capture | Auto-scan around home → user edits categories with 3-level importance (must-have / nice-to-have / don't care) and can remove individual places that aren't part of their life |
| Scan geometry | Both home and locality scans measure from a single center point using identical per-category radii |
| Scoring mode | Quantity-first: nearest-first counts within radius, capped at 20 per category (`NEARBY_MAX_RESULTS`) so dense areas saturate honestly |
| Megastore | OSM has no ratings. A megastore is a `shop=supermarket` carrying a `brand` tag (chains: D-Mart, Reliance, More…) or any `department_store` / `wholesale` / `mall` |
| Comparison | `score = min(candidate / baseline, 1.2)`; baseline 0 on a kept category → treat as 1 |
| Weights | must-have = 3, nice-to-have = 1, don't care = excluded; overall = weighted mean × 100 |
| Equivalence | overall ≥ 85 AND every must-have category ≥ 70 |
| Routine thread | Derived, not scored: ordered chain of must-have categories (+ anchor if given) e.g. `HOME → TRANSIT → WORK → GYM → FOOD → HOME`. Drawn on the home map, then *recreated* on each candidate by snapping each node to the nearest stored place of that category. A node with no place inside its radius renders hollow. |
| Anchor (work/college) | Optional. Not scored. OSRM drive-time from each top-3 locality center to the anchor, shown as a commute relationship. |
| Precompute | CLI script per city → SQLite; stores OSM ids, lat/lng, and derived counts (ODbL data, attribution shown on the map). `scan --force` rebuilds. |
| Live cost per request | 1 Overpass union query for the home scan (~5–15 s on public servers; cached in `point_scans` by ~10 m cell for a week) + 3–6 OSRM routes. Address suggestions are 1 Photon call per keystroke burst. |
| Explanations | Deterministic. `explainRows` in `/shared/explain.ts` derives the verdict and keep / change / give-up / gain lines from the ledger. A locality's one-line *character* is hand-written in the seed list. No model call anywhere. |
| Airport | Informational only (OSRM drive-time to city's main airport, top 3 only; straight-line estimate at 22 km/h if OSRM is down); shown as metadata, not a badge |
| Same-city | Allowed; exclude the locality containing the home address |
| Sparse baseline | Warn ("matches will be lenient"), never block |
| Results | Top 3 |
| Platform | Web: Vite + React + TypeScript, Express, Drizzle + SQLite (better-sqlite3, file under `data/`), single repo `/client` `/server` `/shared` |
| Persistence | SQLite holds precomputed data only; user requests are request-scoped |
| Design direction | Editorial city atlas, map-first, one accent colour, no dashboard idiom (§4.6). The intelligence is invisible: no "AI" anywhere in the UI. |

## 3. Category taxonomy

| Key | Label | OSM tags (`osm` filters in `/shared/categories.ts`) | Radius | Glyph | Notes |
|---|---|---|---|---|---|
| `grocery` | Grocery | `supermarket`, `grocery_store`, `convenience_store` | 750 m | square | Shrunk to stay under 20-cap |
| `megastore` | Megastore | `supermarket` + rating gate | 3 km | hexagon | Requests `rating`, `userRatingCount` |
| `healthcare` | Healthcare | `hospital`, `pharmacy`, `doctor` | 2 km | circle with cross | |
| `fitness` | Gym / fitness | `gym`, `fitness_center` | 1.5 km | diamond | |
| `food` | Restaurants & cafes | `restaurant`, `cafe` | 500 m | filled dot | Shrunk to stay under 20-cap |
| `transit` | Public transport | `train_station`, `subway_station`, `bus_station` | 1.5 km | two horizontal bars | |
| `education` | Education | `school`, `university` | 2 km | triangle | |
| `entertainment` | Entertainment | `movie_theater`, `shopping_mall`, `park` | 3 km | six-point asterisk | |
| `worship` | Places of worship | `place_of_worship`, `hindu_temple`, `mosque`, `church` | 1.5 km | half-filled circle | Off by default |
| `housing` | (internal) | `apartment_building`, `apartment_complex`, `condominium_complex`, `housing_complex` | 1.5 km | — | Residential filter only, never scored |
| — | Airport | `airport` | — | — | Not scanned; Routes API drive-time |

All radii, thresholds, caps, and weights live in `/shared/scoring.ts` as named constants. Glyphs live in `/client/src/atlas/glyphs.tsx` as one SVG symbol set (§4.6).

## 4. Architecture

```
/client   Vite + React + TS      linear 3-movement flow, MapLibre GL on OpenFreeMap tiles repainted to the atlas palette
/server   Express + TS           /api routes, OSM client (Photon / Overpass / OSRM), Drizzle
/shared   TS                     types, category taxonomy, scoring constants, scoring function, routine derivation, explanation
/scripts  TS (tsx)               seed + scan CLI for precompute
```

### 4.1 Data model (SQLite / Drizzle, migrated automatically on first open)

```
cities
  id            text PK        -- 'pune'
  name          text
  center_lat    double
  center_lng    double
  airport_place_id text
  airport_label text           -- 'PNQ'

localities
  id            serial PK
  city_id       text FK
  name          text           -- 'Koramangala'
  sub_region    text null      -- 'Gurugram' (NCR only)
  character     text null      -- hand-written one-liner from the seed list
  center_lat    double         -- geocoded location
  center_lng    double
  vp_sw_lat/lng, vp_ne_lat/lng double  -- geocoded viewport
  housing_count int
  is_residential bool          -- housing_count >= 5, recomputed on demand
  scanned_at    timestamptz

locality_amenity_counts
  locality_id   int FK
  category      text           -- 'grocery'
  count         int
  place_ids     text[]         -- for refresh/debug only
  points        jsonb          -- [{ placeId, lat, lng }] — needed to recreate the routine thread on the map;
                               -- coordinates only; a cache that scan --force rebuilds
  PK (locality_id, category)
```

### 4.2 Server API

```
GET  /api/cities
     → [{ id, name, subRegions? }]

GET  /api/suggest?q=<text>                       -- Photon, India bbox, max 5
     → [{ placeId, label, secondary }]           -- placeId is a self-contained ref (coords + labels, base64url);
                                                 -- Photon has no lookup-by-id, so no second call is needed

POST /api/baseline
     body: { placeId, anchorPlaceId? }              -- from Autocomplete
     → { home: { lat, lng, formattedAddress, localityLabel, cityId? },
         anchor?: { lat, lng, formattedAddress },
         baseline: [{ category, count }],
         places: [{ placeId, category, lat, lng, distanceM }],   -- request-scoped, never stored
         sparse: boolean }

POST /api/match
     body: { home: { lat, lng }, anchor?: { lat, lng }, cityId,
             categories: [{ category, baselineCount, importance }],   -- baselineCount already reflects removed places
             routine: string[] }                                       -- ordered category keys, from client
     → { equivalentFound: boolean,
         results: [{ locality: { id, name, subRegion?, character?, center, viewport },
                     overall,
                     rows: [{ category, baseline, candidate, score, importance }],
                     points: [{ category, lat, lng }],                 -- for glyphs + recreated routine thread
                     airportMinutes, anchorMinutes? }] }
```

`/api/match` never calls Nearby Search — it reads `locality_amenity_counts`, scores in-process using `/shared/scoring.ts`, then makes 3 airport Routes calls (+3 anchor Routes calls if an anchor was given) in parallel for the top 3. Explanations are not part of the response; the client derives them from `rows`.

### 4.3 Scoring (`/shared/scoring.ts`)

```
categoryScore(baseline, candidate):
  b = baseline === 0 ? 1 : baseline
  return min(candidate / b, 1.2)

overall(rows):
  kept = rows.filter(importance !== 'none')
  w = { must: 3, nice: 1 }
  return round(100 * Σ(score_i * w_i) / Σ(w_i))   -- raw max is 120 (cap bonus); clamp to 100 for display only

isEquivalent(rows, overall):
  overall >= 85 && rows.filter(must).every(r => r.score * 100 >= 70)

deriveRoutine(rows, hasAnchor):            -- /shared/routine.ts, display only
  order = ['transit', 'anchor', 'grocery', 'fitness', 'food', 'healthcare', 'education', 'entertainment', 'megastore', 'worship']
  return ['home', ...order.filter(k => k === 'anchor' ? hasAnchor : rows[k].importance === 'must'), 'home']

verdictLine(rows):                         -- deterministic one-liner for the match column
  strong = kept rows with score >= 1.0, weak = kept rows with score < 0.7
  "Strong on {strong}. Weaker on {weak}."  -- omit a clause if its list is empty

explainRows(rows):                         -- /shared/explain.ts, the profile page's four columns
  keep   = kept rows with 0.9 <= score < 1.05   "Grocery at a similar reach (5 vs your 6)."
  change = kept rows with 0.7 <= score < 0.9    "Fewer gyms nearby (1 vs your 2)."
  giveUp = kept rows with score < 0.7           "Healthcare drops to 3 from your 9."
  gain   = kept rows with candidate > baseline  "More restaurants & cafes (16 vs your 14)."
  each list capped at 3 lines; verdict = "Your routine carries over almost intact." or "…; N gaps to weigh."
```

Ranking: sort by `overall` desc; exclude `is_residential = false`; exclude the locality whose viewport contains the home point.

### 4.4 Precompute (`/scripts`)

```
npm run seed            -- upsert cities + seed locality names (from /scripts/seeds/*.json)
npm run scan -- pune    -- for each locality in city:
                           1. forward geocode "<name>, <city>" → center + viewport
                           2. Nearby Search housing types (1.5 km) → housing_count
                           3. Nearby Search each scored category at its radius → count + place_ids + points
                           4. upsert; idempotent
```

Budget: ~60 localities × 10 calls ≈ 600 Pro-SKU calls per city; 4 cities ≈ 2,400, inside the 5,000/month free tier for a single full run. Megastore query alone hits Enterprise SKU.

### 4.5 Client experience

One linear flow in three movements. No sidebar, no tabs, no dashboard. A single hairline top rule carries the wordmark, the pair once known ("Bandra West → Pune"), and the current movement name in small caps. Every screen answers: *does this place let me live the life I already know?*

**Movement I — Two addresses**

```
┌──────────────────────────────────────────────────────────────┐
│ LOCUS                                    YOUR SETUP · TRANSLATION · THE MATCH │
│                                                              │
│   Where do you live now?                     (Newsreader, ~96px)   │
│   ───────────────────────────────────────  (underline input, Autocomplete IN) │
│                                                              │
│   Where are you going?                                       │
│   Mumbai   Pune   Bengaluru   Delhi NCR      (display type, muted; chosen one underlined in accent) │
│                                                              │
│   + Add where you work or study              (collapsed, optional anchor) │
│                                                              │
│                          See how your life translates →      │
└──────────────────────────────────────────────────────────────┘
```

Paper background with a faint graticule (lat/long grid) — the only ambient decoration in the product. Inputs are ruled lines, not boxes. The city chooser is a row of names, not a select.

**Movement II — Your current setup**

Desktop is asymmetric: map ~62% left, editorial column right.

```
┌──────────────────────────────────┬───────────────────────────┐
│  [custom-styled map]             │ YOUR CURRENT SETUP · BANDRA WEST │
│                                  │ Let's see how well          │
│      ◇        ▢                  │ your life translates.       │
│         ⊕ home  ●  ●             │                             │
│   ═      ○ radius lens (drag)    │ ▢ Grocery        6   Must · Nice · Skip │
│              ▢                   │ ◇ Gym            2   Must · Nice · Skip │
│                                  │ ● Food          14   Must · Nice · Skip │
│                                  │ ⊕ Healthcare     9   Must · Nice · Skip │
│                                  │ ═ Transit        3   Must · Nice · Skip │
│                                  │ …                           │
│                                  │ ─────────────────────────── │
│                                  │ YOUR ROUTINE                │
│                                  │ HOME → TRANSIT → GYM → FOOD → HOME │
│                                  │                             │
│                                  │           Translate to Pune → │
└──────────────────────────────────┴───────────────────────────┘
```

- **Map** (MapLibre GL, OpenFreeMap Positron repainted at load): paper land, grey-teal water, hairline roads, every POI layer hidden. Home is an accent-filled ring. Every scanned place is a category glyph drawn by the same SVG `AtlasLayer` that powers the keyless paper fallback, projected through the map's camera. Hairline spokes join home to its must-have places so the area reads as an ecosystem, not pins.
- **Prominence** encodes importance: must-have glyphs 12px filled, nice-to-have 9px stroke, don't-care 6px at 40% opacity. Changing a row's importance re-renders its glyphs immediately.
- **Radius lens** (signature interaction): a draggable ring around home, default 1 km. Dragging it re-labels the column live — "Within 1.0 km: 4 groceries, 2 gyms, 11 restaurants · 82% of your must-haves." Display-only; scoring still uses the fixed per-category radii in §3, and the footnote says so.
- **Ledger rows** replace the table: glyph, label, count as an oversized numeral, and a three-word importance control (`Must · Nice · Skip`) with the active word underlined in accent — not a segmented pill. Hover a row → its glyphs pulse. `worship` defaults to Skip.
- **Correcting assumptions**: click a glyph → a small paper callout with a hairline border: `Nature's Basket · grocery · 400 m · Not mine ×`. Removing greys the glyph and decrements that category's count; the column says "Removed 1 · undo". Copy at the top of the ledger: *"These are here because they're within walking or short-ride reach of your home. Remove anything that isn't part of your life."*
- **Sparse baseline**: an italic serif line inside the column, not a banner — *"Your area is quiet, so there's less to compare against. Matches will be lenient."*
- **Routine thread**: derived from must-haves (+ anchor), typed in condensed caps with arrows and drawn on the map as one hairline path through the nearest instance of each node. Click a node to drop it.

**Movement III — Translation → the match**

The transition is the product's memorable moment. On "Translate to Pune →": the column slides out; the home map desaturates to a line drawing; the routine thread lifts and stays crisp in accent; the map beneath cross-fades and the camera flies to Pune; the thread re-lands on the #1 locality node by node, each snapping to the nearest matching place there. Nodes with no match stay hollow and dashed. ~1.8 s total. `prefers-reduced-motion` → instant swap to the same end state. Interim headline, italic: *"Translating your life to Pune…"*

```
┌──────────────────────────────────┬───────────────────────────┐
│  [Pune map]                      │ THE MATCH · PUNE            │
│   ┌ Aundh ┐  (thin outline,      │ No locality in Pune fully   │
│   │  ⊕→═→◇→● │ name as map label)│ matches your current setup. │
│   └───────┘                      │                             │
│          ┌ Baner ┐               │ Closest match               │
│          └───────┘               │ Aundh            78         │
│   ┌ Kothrud ┐                    │ Strong on transit, groceries, and food. │
│   └─────────┘                    │ Weaker on healthcare and gym access.    │
│                                  │ ─────────────────────────── │
│                                  │ 1  Aundh                 78 │
│                                  │    Quiet, tree-lined, well-connected │
│                                  │    HOME→═→◇→●→HOME  (mini thread, hollow = missing) │
│                                  │ 2  Baner                 74 │
│                                  │ 3  Kothrud               71 │
│                                  │                             │
│                                  │ Compare two →               │
└──────────────────────────────────┴───────────────────────────┘
```

- **Verdict first, honestly.** If `equivalentFound`: *"Your life translates well to Pune."* + `Closest match · Aundh · 91`. Otherwise the headline is *"No locality in Pune fully matches your current setup."* followed by the closest match and its number, then `verdictLine` from §4.3. Never a forced recommendation; never judgmental.
- **Ranking** uses real numerals 1–3 because rank is a true sequence. Entries are separated by hairlines, not cards: name in serif, a ≤10-word character line (from the seed list; fallback: sub-region), the overall as an oversized number, and a miniature routine thread with hollow nodes for what's missing.
- **Map** draws the three viewports as thin outlines with locality names set in serif directly on the map. Hover an entry → outline thickens; click → detail page.
- **Compare two**: pick two entries → the map splits into two panes; the same routine thread is drawn in each; between them the ledger shows *yours* and both candidates on a shared strip per category. This is the second signature interaction.

**Locality detail — a magazine profile** (`/match/:localityId`)

```
PUNE · NORTH-WEST · 14 MIN TO PNQ · 24 MIN TO YOUR WORK

Aundh                                   (Newsreader, ~120px)
Quiet, tree-lined, well-connected.      (italic character line)

┌──────────────────────────────────┐   78
│ [large map fragment with the     │   of your routine preserved
│  recreated routine thread and    │   Closest match to your current setup
│  category glyphs]                │
└──────────────────────────────────┘

LEDGER                    YOURS   HERE
▢ Grocery     must          6      5    ──┼──●─   83
◇ Gym         must          2      1    ─●───┼──   50   must-have below 70
● Food        nice         14     16    ────┼─●─  100+
…

WHAT YOU'D KEEP        WHAT WOULD CHANGE     WHAT YOU'D GIVE UP     WHAT YOU'D GAIN
· Daily groceries      · Fewer gyms nearby    · A second gym option   · Larger parks
  within a short walk  · Longer hospital run  · …                     · …
```

- The **range strip** replaces bars and graphs: one hairline per category, an accent tick for *yours*, an ink tick for *here*, a faint band marking the 70 threshold. Failing must-haves are set in accent with a small `must-have below 70` label — no red, no icons.
- The four columns come from `explainRows` (§4.3), up to 3 terse lines each, computed on the client from the ledger.
- Commute relationships (airport, anchor) are metadata in the eyebrow line, not chips.

**Mobile**: same order, stacked. The map is a sticky ~45vh band at the top; columns scroll beneath it. The radius lens becomes a slider under the map; compare becomes a horizontal swipe between the two panes. No hamburger — the flow is linear.

### 4.6 Design system (`/client/src/atlas/`)

Reference feeling: *"a really good city magazine accidentally became an app."* An old atlas redrawn by a modern product designer.

**Tokens**

| Token | Value | Use |
|---|---|---|
| `paper` | `#EFEBE3` | page background |
| `ink` | `#232323` | all type, outlines |
| `ink-soft` | `#6B6862` | metadata, secondary labels, don't-care glyphs |
| `rule` | `#D9D3C7` | hairlines, dividers, input underlines |
| `ballpoint` | `#2B4ACB` | **the one accent** — the user's home and places, the closest match, primary actions, *yours* ticks. Named for the pen you'd circle places on a paper map with. |
| `map-land` `#E9E4D8` · `map-water` `#C9D3D1` · `map-green` `#D3D9C6` · `map-road` `#D5CFC2` · `map-built` `#E2DCCF` · `map-label` `#857F73` | | Applied to the vector basemap in `applyAtlasPaint`; POI layers hidden |

No status colours. "Weak" is expressed by position on the range strip, an accent highlight, and a label — never red/amber/green.

**Type**

| Role | Face | Setting |
|---|---|---|
| Display | Newsreader (variable, `opsz`, true italic) | city and locality names, statements, oversized numbers; italic for character lines and annotations |
| Body / UI | Schibsted Grotesk | 15px / 1.5; buttons, ledger labels, explanations |
| Metadata / map | Archivo Narrow | 11–12px uppercase, tracked +6%; eyebrows, routine thread, map labels, ticks |

Scale: 12 · 15 · 20 · 32 · 56 · 96 · 144. Oversized numbers (56–144) always carry a small Archivo Narrow label beneath.

**Glyph family** (`glyphs.tsx`): one stroke-only geometric SVG set at 12px, listed in §3. Home is the only filled accent ring. Fill = must-have, stroke = nice-to-have, faded = don't care. Hollow + dashed = "no equivalent here" on a recreated thread.

**Components**: hairline rules; radius 0–2px; no drop shadows; buttons are text + arrow with an accent underline; inputs are underlines; the only card-like element is the map callout (paper, 1px ink border). Layouts are asymmetric (62/38, 55/45). Whitespace is generous; density lives in the ledger only.

**Copy rules**: "Your current setup", "Your regular places", "What you'd keep", "What would change", "Your closest match". Sentence case, plain verbs, the action name persists ("Translate to Pune →" → "Translating your life to Pune…"). Never: "AI-powered", "smart", "recommendation", "personalization", sparkles, or a chat surface.

**Avoid** (from the brief, enforced in review): purple gradients, glow, glassmorphism, rounded-card grids, badges/pills, star ratings, dashboard charts, red pins, stock imagery, 3D illustration, floating assistant buttons.

## 5. Milestones

**M0 — Scaffold (½ day)**
- Monorepo with npm workspaces, TS configs, Vite client, Express server, Drizzle + SQLite (auto-migrated on open), `/shared` package wired into both.
- One `.env` at the repo root: `GOOGLE_MAPS_SERVER_KEY`, `GOOGLE_MAPS_BROWSER_KEY` (referrer-restricted; Vite exposes it), `GOOGLE_MAPS_MAP_ID` (optional cloud style), `DATABASE_FILE`.
- Fonts (Newsreader, Schibsted Grotesk, Archivo Narrow) and the token file in `/client/src/atlas/tokens.css`.

**M1 — Precompute pipeline (1 day)**
- Drizzle schema + migration (including `points`).
- OSM client wrapper (`/server/src/osm.ts`): Photon autocomplete + geocode, one Overpass union query per point with host fallback, OSRM drive time with straight-line fallback.
- Seed JSON for 4 cities (Claude drafts, you skim).
- `scan` script, run for Pune first; sanity-check counts, residential flags, and a plotted sample of points by eye.
- Run remaining 3 cities.

**M2 — Scoring + API (½ day)**
- `/shared/scoring.ts` with unit tests for `categoryScore`, `overall`, `isEquivalent`, `verdictLine`, and edge cases (baseline 0, saturated 20/20, all don't-care).
- `/shared/routine.ts` with tests for `deriveRoutine` (no must-haves, with/without anchor).
- `/api/cities`, `/api/baseline` (with `places`), `/api/match` (without Routes).

**M3 — Atlas UI (1½ days)**
- MapLibre basemap repainted to the `map-*` tokens; POI layers hidden. Glyph set and the projected SVG `AtlasLayer`; paper drawn until tiles load.
- Movement I and II end-to-end on Pune: underline inputs, city row, ledger rows with importance control, prominence-by-importance, radius lens, place removal with undo, routine thread on the map.
- Movement III: results column with honest verdict header, ranked entries with mini threads, viewport outlines with serif map labels.
- Locality detail page: profile header, map fragment with recreated thread, range-strip ledger, four columns rendered from `explainRows`.
- Mobile stacking with the sticky map band. Keyboard focus visible everywhere; `prefers-reduced-motion` respected.

**M4 — Polish layer (1 day)**
- The translation transition (desaturate → lift thread → fly → re-land node by node).
- Compare-two split view.
- Routes API airport and anchor drive-times.
- Sparse-baseline line, same-city exclusion, "no equivalent" state copy.

**M5 — Demo hardening (½ day)**
- Demo script: Bandra West → Pune (equivalent found), and a case that produces "No locality in … fully matches your current setup".
- Error states in the interface's voice for Overpass/Photon timeouts ("Maps didn't answer. Try again in a moment.") — no toasts stacked over the map.
- Screenshot pass against §4.6's avoid list; remove one element per screen if it isn't earning its place.
- README with setup + scan instructions.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Geocoding returns a wrong/huge viewport for a locality name | Scan from center only (viewport is display-only); manual override field in seed JSON |
| 20-result ceiling flattens dense categories | Radii shrunk for `food`/`grocery`; saturated-vs-saturated reads as 1.0 which is honest |
| Public Overpass is slow or down mid-demo | One request per point; `overpass.openstreetmap.fr` first (the only host reachable from the dev network), mirrors as fallback; live home scans cached in `point_scans`; the demo addresses are pre-warmed before going on stage; `VITE_MOCK=1` is the last resort |
| OSM POI coverage in Indian cities is patchy | Scoring is ratio-based, so uneven-but-consistent coverage still ranks sensibly; the sparse-baseline warning covers thin home areas; seed list favours well-mapped localities |
| ODbL attribution | MapLibre attribution control kept (styled small); stored data is OSM ids + coordinates + counts |
| Translation animation janks on stage laptop | Built on Maps camera `moveCamera` + CSS transitions only; reduced-motion path is the same end state and is the demo fallback |
| Custom map style looks like a default map | Style reviewed against tokens at M3; POI layer off is non-negotiable |
| Seed list misses a locality judges know | Re-running `scan` for one city is cheap; add names to JSON and rerun |

## 7. Tunable constants (all in `/shared`)

`scoring.ts`: `RADII_M`, `SCORE_CAP = 1.2`, `WEIGHTS = { must: 3, nice: 1 }`, `EQUIV_OVERALL = 85`, `EQUIV_MUST_MIN = 70`, `RESIDENTIAL_MIN_HOUSING = 5`, `MEGASTORE_MIN_REVIEWS = 300`, `MEGASTORE_MIN_RATING = 4.0`, `SPARSE_BASELINE_TOTAL = 5`, `NEARBY_MAX_RESULTS = 20`, `LENS_DEFAULT_M = 1000`.
`routine.ts`: `ROUTINE_ORDER`.
`explain.ts`: `KEEP_MIN = 0.9`, `KEEP_MAX = 1.05`, `CHANGE_MIN = 0.7`, `EXPLAIN_MAX_LINES = 3`.
