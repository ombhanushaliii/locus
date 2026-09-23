/**
 * Fallback JSON style for maps without a cloud Map ID.
 * Mirrors tokens.css --map-* values. POI layer is off: the user's places are the only marks.
 * With a Map ID configured, replicate this in Google Cloud Console -> Map Styles.
 */
export const ATLAS_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#e9e4d8' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#857f73' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#e9e4d8' }, { weight: 2 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#bfb8aa' }, { weight: 0.6 }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#e2dccf' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e9e4d8' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d3d9c6' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#d5cfc2' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a39e93' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#cfc8b9' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#c9c2b3' }, { visibility: 'on' }, { weight: 0.8 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d3d1' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#8a9795' }] },
];

export const MAP_DEFAULTS = {
  disableDefaultUI: true,
  zoomControl: false,
  gestureHandling: 'greedy' as const,
  clickableIcons: false,
  backgroundColor: '#e9e4d8',
};
