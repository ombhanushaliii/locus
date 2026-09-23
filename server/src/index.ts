import cors from 'cors';
import express from 'express';
import type { CityInfo } from '@locus/shared';

const app = express();
app.use(cors({ origin: [/localhost:\d+$/] }));
app.use(express.json({ limit: '256kb' }));

const CITIES: CityInfo[] = [
  { id: 'mumbai', name: 'Mumbai' },
  { id: 'pune', name: 'Pune' },
  { id: 'bengaluru', name: 'Bengaluru' },
  { id: 'delhi-ncr', name: 'Delhi NCR', subRegions: ['Delhi', 'Gurugram', 'Noida'] },
];

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/cities', (_req, res) => {
  res.json(CITIES);
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`locus server on http://localhost:${port}`);
});
