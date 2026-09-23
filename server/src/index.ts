import cors from 'cors';
import express from 'express';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  CATEGORY_KEYS,
  buildRows,
  isEquivalent,
  isSparse,
  overall,
  viewportContains,
  type BaselineResponse,
  type CategoryKey,
  type CityInfo,
  type MatchResponse,
  type MatchResult,
} from '@locus/shared';
import { getDb, schema } from './db/index.js';
import { GoogleError, autocomplete, driveMinutes, placeLocation } from './google.js';
import { scanAround, toPlacePoints } from './scan.js';

const app = express();
app.use(cors({ origin: [/localhost:\d+$/] }));
app.use(express.json({ limit: '256kb' }));

const latLng = z.object({ lat: z.number(), lng: z.number() });

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/cities', async (_req, res) => {
  const db = getDb();
  const cities = await db.select().from(schema.cities);
  const locs = await db.select({ cityId: schema.localities.cityId, subRegion: schema.localities.subRegion }).from(schema.localities);
  const out: CityInfo[] = cities.map((c) => {
    const subs = [...new Set(locs.filter((l) => l.cityId === c.id && l.subRegion).map((l) => l.subRegion!))];
    return { id: c.id, name: c.name, ...(subs.length ? { subRegions: subs } : {}) };
  });
  res.json(out);
});

app.get('/api/suggest', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    res.json(await autocomplete(q));
  } catch (e) {
    next(e);
  }
});

const baselineBody = z.object({ placeId: z.string().min(1), anchorPlaceId: z.string().min(1).optional() });

app.post('/api/baseline', async (req, res, next) => {
  try {
    const body = baselineBody.parse(req.body);
    const [home, anchor] = await Promise.all([placeLocation(body.placeId), body.anchorPlaceId ? placeLocation(body.anchorPlaceId) : undefined]);
    const scan = await scanAround(home.location, false);
    const baseline = CATEGORY_KEYS.map((k) => ({ category: k, count: scan[k].count }));
    const out: BaselineResponse = {
      home: { ...home.location, formattedAddress: home.formattedAddress, localityLabel: home.localityLabel },
      anchor: anchor ? { ...anchor.location, formattedAddress: anchor.formattedAddress } : undefined,
      baseline,
      places: toPlacePoints(home.location, scan),
      sparse: isSparse(baseline),
    };
    res.json(out);
  } catch (e) {
    next(e);
  }
});

const matchBody = z.object({
  home: latLng,
  anchor: latLng.optional(),
  cityId: z.string().min(1),
  categories: z.array(
    z.object({
      category: z.enum(CATEGORY_KEYS),
      baselineCount: z.number().int().min(0),
      importance: z.enum(['must', 'nice', 'none']),
    }),
  ),
});

app.post('/api/match', async (req, res, next) => {
  try {
    const body = matchBody.parse(req.body);
    const db = getDb();
    const city = (await db.select().from(schema.cities).where(eq(schema.cities.id, body.cityId)))[0];
    if (!city) {
      res.status(404).json({ error: `Unknown city ${body.cityId}` });
      return;
    }

    const locs = await db
      .select()
      .from(schema.localities)
      .where(and(eq(schema.localities.cityId, city.id), eq(schema.localities.isResidential, true), isNotNull(schema.localities.scannedAt)));
    const counts = await db.select().from(schema.localityAmenityCounts);
    const byLocality = new Map<number, typeof counts>();
    for (const c of counts) byLocality.set(c.localityId, [...(byLocality.get(c.localityId) ?? []), c]);

    const scored = locs
      .map((l) => {
        const viewport = { sw: { lat: l.vpSwLat!, lng: l.vpSwLng! }, ne: { lat: l.vpNeLat!, lng: l.vpNeLng! } };
        if (viewportContains(viewport, body.home)) return null;
        const rows = byLocality.get(l.id) ?? [];
        const candidate = Object.fromEntries(rows.map((r) => [r.category, r.count])) as Partial<Record<CategoryKey, number>>;
        const scoreRows = buildRows(body.categories, candidate);
        const result: MatchResult = {
          locality: {
            id: l.id,
            name: l.name,
            subRegion: l.subRegion ?? undefined,
            character: l.character ?? undefined,
            center: { lat: l.centerLat!, lng: l.centerLng! },
            viewport,
          },
          overall: overall(scoreRows),
          rows: scoreRows,
          points: rows.flatMap((r) => r.points.map((p) => ({ lat: p.lat, lng: p.lng, category: r.category as CategoryKey }))),
          airportMinutes: null,
        };
        return result;
      })
      .filter((r): r is MatchResult => r !== null)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 3);

    await Promise.all(
      scored.map(async (r) => {
        const [airport, anchor] = await Promise.all([
          driveMinutes(r.locality.center, { lat: city.airportLat, lng: city.airportLng }),
          body.anchor ? driveMinutes(r.locality.center, body.anchor) : Promise.resolve(undefined),
        ]);
        r.airportMinutes = airport;
        if (anchor !== undefined) r.anchorMinutes = anchor;
      }),
    );

    const out: MatchResponse = {
      equivalentFound: scored.some((r) => isEquivalent(r.rows, r.overall)),
      cityName: city.name,
      results: scored,
    };
    res.json(out);
  } catch (e) {
    next(e);
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Bad request', issues: err.issues });
    return;
  }
  if (err instanceof GoogleError) {
    console.error(err.message);
    res.status(502).json({ error: 'Maps did not answer', endpoint: err.endpoint, status: err.status });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`locus server on http://localhost:${port}`);
});
