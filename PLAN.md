# Locus — Implementation Plan

Find the locality in a new Indian city that best preserves the day-to-day life you have now.

## 1. Product scope (v1, hackathon)

- **Input**: user's current home address (anywhere in India) + a target city.
- **Output**: top 3 localities in the target city ranked by "lifestyle match" (0–100), each with a per-category breakdown, a 2-sentence LLM explanation, and an airport drive-time chip. If nothing qualifies as an equivalent, say so and show the closest alternative with failing rows highlighted.
- **Target cities**: Mumbai, Pune, Bengaluru, Delhi NCR (Delhi / Gurugram / Noida, tagged by sub-region).
- **Out of scope**: rent, quality scoring beyond the Megastore gate, accounts/auth, user-data persistence, global cities.

## 2. Settled decisions

| # | Decision |
|---|---|
| Data source | Google Maps Platform only: Places API (New) Nearby Search, Geocoding, Places Autocomplete (New), Routes API |
| Locality unit | Curated seed list per city (~50–60 names), forward-geocoded to center + viewport; filtered for residential-ness |
| Residential filter | `apartment_building/apartment_complex/condominium_complex/housing_complex` count within 1.5 km of center; `< 5` → flagged non-residential, excluded from ranking, kept in DB |
| Baseline capture | Auto-scan around home → user edits categories with 3-level importance (must-have / nice-to-have / don't care) |
| Scan geometry | Both home and locality scans measure from a single center point using identical per-category radii |
| Scoring mode | Quantity-first: counts within radius, capped by Google's 20-result ceiling |
| Megastore | Any `supermarket` with `userRatingCount ≥ 300` and `rating ≥ 4.0` (Enterprise SKU fields, this query only) |
| Comparison | `score = min(candidate / baseline, 1.2)`; baseline 0 on a kept category → treat as 1 |
| Weights | must-have = 3, nice-to-have = 1, don't care = excluded; overall = weighted mean × 100 |
| Equivalence | overall ≥ 85 AND every must-have category ≥ 70 |
| Precompute | CLI script per city → Neon; stores `place_id`s + derived counts only, never names/ratings; refreshable |
| Live cost per request | ~10 Nearby Search (home scan) + 1 Geocode + 3 Routes + 3 LLM calls |
| Explanations | Deterministic table is source of truth; Claude writes 2 sentences per result from the row data, strict timeout, silent fallback |
| Airport | Informational only (Routes API drive-time to city's main airport, top 3 only) |
| Same-city | Allowed; exclude the locality containing the home address |
| Sparse baseline | Warn ("results will be lenient"), never block |
| Results | Top 3 |
| Platform | Web: Vite + React + TypeScript, Express, Drizzle + Neon serverless, single repo `/client` `/server` `/shared` |
| Persistence | Neon holds precomputed data only; user requests are request-scoped |

## 3. Category taxonomy

| Key | Label | Google `includedTypes` | Radius | Notes |
|---|---|---|---|---|
| `grocery` | Grocery | `supermarket`, `grocery_store`, `convenience_store` | 750 m | Shrunk to stay under 20-cap |
| `megastore` | Megastore | `supermarket` + rating gate | 3 km | Requests `rating`, `userRatingCount` |
| `healthcare` | Healthcare | `hospital`, `pharmacy`, `doctor` | 2 km | |
| `fitness` | Gym / fitness | `gym`, `fitness_center` | 1.5 km | |
| `food` | Restaurants & cafes | `restaurant`, `cafe` | 500 m | Shrunk to stay under 20-cap |
| `transit` | Public transport | `train_station`, `subway_station`, `bus_station` | 1.5 km | |
| `education` | Education | `school`, `university` | 2 km | |
| `entertainment` | Entertainment | `movie_theater`, `shopping_mall`, `park` | 3 km | |
| `worship` | Places of worship | `place_of_worship`, `hindu_temple`, `mosque`, `church` | 1.5 km | Off by default |
| `housing` | (internal) | `apartment_building`, `apartment_complex`, `condominium_complex`, `housing_complex` | 1.5 km | Residential filter only, never scored |
| — | Airport | `airport` | — | Not scanned; Routes API drive-time chip |

All radii, thresholds, caps, and weights live in `/shared/scoring.ts` as named constants.

## 4. Architecture

```
/client   Vite + React + TS      3-step wizard, Google Maps JS
/server   Express + TS           /api routes, Google + Claude clients, Drizzle
/shared   TS                     types, category taxonomy, scoring constants, scoring function
/scripts  TS (tsx)               seed + scan CLI for precompute
```

### 4.1 Data model (Neon / Drizzle)

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
  PK (locality_id, category)
```

### 4.2 Server API

```
GET  /api/cities
     → [{ id, name, subRegions? }]

POST /api/baseline
     body: { placeId }                        -- from Autocomplete
     → { home: { lat, lng, formattedAddress, cityId? },
         baseline: [{ category, count }],
         sparse: boolean }

POST /api/match
     body: { home: { lat, lng }, cityId,
             categories: [{ category, baselineCount, importance }] }
     → { equivalentFound: boolean,
         results: [{ locality, overall, rows: [{ category, baseline, candidate, score, importance }],
                     airportMinutes, explanation }] }
```

`/api/match` never calls Nearby Search — it reads `locality_amenity_counts`, scores in-process using `/shared/scoring.ts`, then makes 3 Routes calls and 3 Claude calls in parallel for the top 3.

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
```

Ranking: sort by `overall` desc; exclude `is_residential = false`; exclude the locality whose viewport contains the home point.

### 4.4 Precompute (`/scripts`)

```
npm run seed            -- upsert cities + seed locality names (from /scripts/seeds/*.json)
npm run scan -- pune    -- for each locality in city:
                           1. forward geocode "<name>, <city>" → center + viewport
                           2. Nearby Search housing types (1.5 km) → housing_count
                           3. Nearby Search each scored category at its radius → count + place_ids
                           4. upsert; idempotent
```

Budget: ~60 localities × 10 calls ≈ 600 Pro-SKU calls per city; 4 cities ≈ 2,400, inside the 5,000/month free tier for a single full run. Megastore query alone hits Enterprise SKU.

### 4.5 Client flow

1. **Step 1 — Where you live / where you're going**: Places Autocomplete (New) input restricted to `country: in`; target city select (NCR shows sub-region grouping later, not here).
2. **Step 2 — Your baseline**: table of categories with auto-scanned counts; importance segmented control per row (must / nice / don't care); `worship` present but defaulted to don't care; sparse-baseline warning banner if applicable.
3. **Step 3 — Results**: left column ranked top 3 cards (overall score, equivalent badge or "closest alternative" badge, LLM blurb, airport chip, expandable per-row breakdown with failing must-haves highlighted); right column Google Maps JS with the 3 viewports tinted by score, click-to-highlight; compact "Your current area" card above the list for side-by-side.

## 5. Milestones

**M0 — Scaffold (½ day)**
- Monorepo with npm workspaces, TS configs, Vite client, Express server, Drizzle + Neon connection, `/shared` package wired into both.
- `.env` handling: `GOOGLE_MAPS_SERVER_KEY`, `GOOGLE_MAPS_BROWSER_KEY` (referrer-restricted), `ANTHROPIC_API_KEY`, `DATABASE_URL`.

**M1 — Precompute pipeline (1 day)**
- Drizzle schema + migration.
- Google client wrapper: geocode, nearbySearch (typed, field-mask aware, SKU-minimal).
- Seed JSON for 4 cities (Claude drafts, you skim).
- `scan` script, run for Pune first; sanity-check counts and residential flags by eye.
- Run remaining 3 cities.

**M2 — Scoring + API (½ day)**
- `/shared/scoring.ts` with unit tests for `categoryScore`, `overall`, `isEquivalent`, and edge cases (baseline 0, saturated 20/20, all don't-care).
- `/api/cities`, `/api/baseline`, `/api/match` (without LLM/airport).

**M3 — Wizard UI (1 day)**
- Steps 1–3 functional end-to-end on Pune.
- Google Maps JS with tinted viewports.

**M4 — Polish layer (½ day)**
- Claude explanations with timeout + fallback (confirm model id from current docs at this step).
- Routes API airport chips.
- Sparse-baseline warning, same-city exclusion, "no equivalent" state.

**M5 — Demo hardening (½ day)**
- Demo script: Bandra West → Pune, and a case that produces "no direct equivalent".
- Error states for Google quota/auth failures.
- README with setup + scan instructions.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Geocoding returns a wrong/huge viewport for a locality name | Scan from center only (viewport is display-only); manual override field in seed JSON |
| 20-result ceiling flattens dense categories | Radii shrunk for `food`/`grocery`; saturated-vs-saturated reads as 1.0 which is honest |
| Google quota exhausted mid-demo | Precompute means live path is ~10 Places calls; keep a second API key as fallback |
| Places caching ToS | Store `place_id`s + aggregate counts only; document as refreshable cache |
| Claude call slow/fails on stage | 4 s timeout, table always renders, blurb streams in if it arrives |
| Seed list misses a locality judges know | Re-running `scan` for one city is cheap; add names to JSON and rerun |

## 7. Tunable constants (all in `/shared/scoring.ts`)

`RADII_M`, `SCORE_CAP = 1.2`, `WEIGHTS = { must: 3, nice: 1 }`, `EQUIV_OVERALL = 85`, `EQUIV_MUST_MIN = 70`, `RESIDENTIAL_MIN_HOUSING = 5`, `MEGASTORE_MIN_REVIEWS = 300`, `MEGASTORE_MIN_RATING = 4.0`, `SPARSE_BASELINE_TOTAL = 5`, `NEARBY_MAX_RESULTS = 20`.
