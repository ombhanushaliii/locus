import { metersBetween, reachM, type CategoryKey, type LatLng, type RoutineNode } from '@locus/shared';

export { metersBetween };

const M_PER_DEG_LAT = 111_320;

/** Local equirectangular projection: metres east/north of `center`. */
export function toLocalMeters(center: LatLng, p: LatLng): { east: number; north: number } {
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  return {
    east: (p.lng - center.lng) * M_PER_DEG_LAT * cosLat,
    north: (p.lat - center.lat) * M_PER_DEG_LAT,
  };
}

export function fromLocalMeters(center: LatLng, east: number, north: number): LatLng {
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  return { lat: center.lat + north / M_PER_DEG_LAT, lng: center.lng + east / (M_PER_DEG_LAT * cosLat) };
}

export interface ThreadNode {
  node: RoutineNode;
  point: LatLng | null;
}

/**
 * Snap each routine node to the nearest place of its category around `origin`.
 * A node with no place inside its category radius has point = null ("missing").
 */
export function buildThread(
  routine: readonly RoutineNode[],
  origin: LatLng,
  anchor: LatLng | null | undefined,
  points: readonly (LatLng & { category: CategoryKey })[],
): ThreadNode[] {
  return routine.map((node) => {
    if (node === 'home') return { node, point: origin };
    if (node === 'anchor') return { node, point: anchor ?? null };
    const radius = reachM(node as CategoryKey);
    let best: LatLng | null = null;
    let bestD = Infinity;
    for (const p of points) {
      if (p.category !== node) continue;
      const d = metersBetween(origin, p);
      if (d < bestD && d <= radius) {
        bestD = d;
        best = { lat: p.lat, lng: p.lng };
      }
    }
    return { node, point: best };
  });
}

export function formatKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
