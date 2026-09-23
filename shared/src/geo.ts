import type { LatLng, Viewport } from './types.js';

const EARTH_R = 6371e3;
const toRad = (x: number) => (x * Math.PI) / 180;

export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function viewportContains(v: Viewport, p: LatLng): boolean {
  return p.lat >= v.sw.lat && p.lat <= v.ne.lat && p.lng >= v.sw.lng && p.lng <= v.ne.lng;
}
