import path from 'node:path';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CityConfig {
  id: string;
  name: string;
  state: string;
  center: LatLng;
  /** Extent of the metro area we consider "the city" (localities beyond this are ignored). */
  radiusKm: number;
  /** Optional sub-regions (NCR); a locality is tagged with the nearest one. */
  subRegions?: { name: string; center: LatLng }[];
}

export const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
export const DATA_DIR = path.join(REPO_ROOT, 'data');
export const OSM_DIR = path.join(DATA_DIR, 'osm');
export const CITIES_DIR = path.join(DATA_DIR, 'cities');

export const CITIES: CityConfig[] = [
  { id: 'pune', name: 'Pune', state: 'Maharashtra', center: { lat: 18.5204, lng: 73.8567 }, radiusKm: 22 },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', center: { lat: 19.076, lng: 72.8777 }, radiusKm: 32 },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', center: { lat: 12.9716, lng: 77.5946 }, radiusKm: 25 },
  {
    id: 'delhi-ncr',
    name: 'Delhi NCR',
    state: 'Delhi',
    center: { lat: 28.6139, lng: 77.209 },
    radiusKm: 42,
    subRegions: [
      { name: 'Delhi', center: { lat: 28.6139, lng: 77.209 } },
      { name: 'Gurugram', center: { lat: 28.4595, lng: 77.0266 } },
      { name: 'Noida', center: { lat: 28.5355, lng: 77.391 } },
      { name: 'Ghaziabad', center: { lat: 28.6692, lng: 77.4538 } },
      { name: 'Faridabad', center: { lat: 28.4089, lng: 77.3178 } },
    ],
  },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', center: { lat: 17.385, lng: 78.4867 }, radiusKm: 28 },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', center: { lat: 13.0827, lng: 80.2707 }, radiusKm: 28 },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', center: { lat: 22.5726, lng: 88.3639 }, radiusKm: 25 },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', center: { lat: 23.0225, lng: 72.5714 }, radiusKm: 22 },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', center: { lat: 26.9124, lng: 75.7873 }, radiusKm: 18 },
  { id: 'surat', name: 'Surat', state: 'Gujarat', center: { lat: 21.1702, lng: 72.8311 }, radiusKm: 16 },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', center: { lat: 26.8467, lng: 80.9462 }, radiusKm: 16 },
  { id: 'kochi', name: 'Kochi', state: 'Kerala', center: { lat: 9.9312, lng: 76.2673 }, radiusKm: 16 },
  { id: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh', center: { lat: 30.7333, lng: 76.7794 }, radiusKm: 16 },
  { id: 'indore', name: 'Indore', state: 'Madhya Pradesh', center: { lat: 22.7196, lng: 75.8577 }, radiusKm: 14 },
  { id: 'nagpur', name: 'Nagpur', state: 'Maharashtra', center: { lat: 21.1458, lng: 79.0882 }, radiusKm: 14 },
  { id: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', center: { lat: 23.2599, lng: 77.4126 }, radiusKm: 14 },
  { id: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', center: { lat: 11.0168, lng: 76.9558 }, radiusKm: 14 },
  { id: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', center: { lat: 17.6868, lng: 83.2185 }, radiusKm: 14 },
  { id: 'thiruvananthapuram', name: 'Thiruvananthapuram', state: 'Kerala', center: { lat: 8.5241, lng: 76.9366 }, radiusKm: 14 },
  { id: 'goa', name: 'Goa', state: 'Goa', center: { lat: 15.4909, lng: 73.8278 }, radiusKm: 30 },
  { id: 'mysuru', name: 'Mysuru', state: 'Karnataka', center: { lat: 12.2958, lng: 76.6394 }, radiusKm: 12 },
  { id: 'vadodara', name: 'Vadodara', state: 'Gujarat', center: { lat: 22.3072, lng: 73.1812 }, radiusKm: 14 },
  { id: 'mangaluru', name: 'Mangaluru', state: 'Karnataka', center: { lat: 12.9141, lng: 74.856 }, radiusKm: 12 },
  { id: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha', center: { lat: 20.2961, lng: 85.8245 }, radiusKm: 14 },
  { id: 'guwahati', name: 'Guwahati', state: 'Assam', center: { lat: 26.1445, lng: 91.7362 }, radiusKm: 14 },
  { id: 'dehradun', name: 'Dehradun', state: 'Uttarakhand', center: { lat: 30.3165, lng: 78.0322 }, radiusKm: 12 },
  { id: 'nashik', name: 'Nashik', state: 'Maharashtra', center: { lat: 19.9975, lng: 73.7898 }, radiusKm: 12 },
  { id: 'vijayawada', name: 'Vijayawada', state: 'Andhra Pradesh', center: { lat: 16.5062, lng: 80.648 }, radiusKm: 12 },
  { id: 'madurai', name: 'Madurai', state: 'Tamil Nadu', center: { lat: 9.9252, lng: 78.1198 }, radiusKm: 12 },
  { id: 'patna', name: 'Patna', state: 'Bihar', center: { lat: 25.5941, lng: 85.1376 }, radiusKm: 12 },
  { id: 'ranchi', name: 'Ranchi', state: 'Jharkhand', center: { lat: 23.3441, lng: 85.3096 }, radiusKm: 12 },
  { id: 'raipur', name: 'Raipur', state: 'Chhattisgarh', center: { lat: 21.2514, lng: 81.6296 }, radiusKm: 12 },
  { id: 'kanpur', name: 'Kanpur', state: 'Uttar Pradesh', center: { lat: 26.4499, lng: 80.3319 }, radiusKm: 12 },
  { id: 'ludhiana', name: 'Ludhiana', state: 'Punjab', center: { lat: 30.901, lng: 75.8573 }, radiusKm: 12 },
  { id: 'amritsar', name: 'Amritsar', state: 'Punjab', center: { lat: 31.634, lng: 74.8723 }, radiusKm: 12 },
  { id: 'jodhpur', name: 'Jodhpur', state: 'Rajasthan', center: { lat: 26.2389, lng: 73.0243 }, radiusKm: 12 },
  { id: 'udaipur', name: 'Udaipur', state: 'Rajasthan', center: { lat: 24.5854, lng: 73.7125 }, radiusKm: 10 },
  { id: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh', center: { lat: 25.3176, lng: 82.9739 }, radiusKm: 12 },
  { id: 'agra', name: 'Agra', state: 'Uttar Pradesh', center: { lat: 27.1767, lng: 78.0081 }, radiusKm: 12 },
  { id: 'tiruchirappalli', name: 'Tiruchirappalli', state: 'Tamil Nadu', center: { lat: 10.7905, lng: 78.7047 }, radiusKm: 12 },
];

export function cityById(id: string): CityConfig {
  const c = CITIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown city '${id}'. Known: ${CITIES.map((x) => x.id).join(', ')}`);
  return c;
}

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Square bbox around the city radius, padded by `padKm` so edge localities get full reach. */
export function cityBbox(c: CityConfig, padKm = 4): Bbox {
  const km = c.radiusKm + padKm;
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((c.center.lat * Math.PI) / 180));
  return { west: c.center.lng - dLng, east: c.center.lng + dLng, south: c.center.lat - dLat, north: c.center.lat + dLat };
}

export function cityDir(c: CityConfig): string {
  return path.join(CITIES_DIR, c.id);
}
