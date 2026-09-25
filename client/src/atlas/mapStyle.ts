import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Keyless vector basemap (OpenFreeMap, OpenMapTiles schema). We load its Positron
 * style and repaint it to the paper/ink palette from tokens.css, then hide every
 * POI so the user's own places are the only marks on the map.
 */
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const C = {
  land: '#e9e4d8',
  water: '#c9d3d1',
  waterDeep: '#b9c6c4',
  green: '#d3d9c6',
  road: '#d5cfc2',
  roadMajor: '#cbc4b4',
  built: '#e2dccf',
  builtLine: '#d9d3c7',
  label: '#857f73',
  labelFaint: '#a39e93',
  rule: '#bfb8aa',
};

export function applyAtlasPaint(map: MapLibreMap): void {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const id = layer.id;
    const src = 'source-layer' in layer ? layer['source-layer'] : undefined;
    const set = (prop: string, value: unknown) => {
      try {
        map.setPaintProperty(id, prop as never, value as never);
      } catch {
        /* property not valid for this layer type */
      }
    };
    const hide = () => map.setLayoutProperty(id, 'visibility', 'none');

    if (layer.type === 'background') {
      set('background-color', C.land);
      continue;
    }
    if (layer.type === 'raster') {
      hide();
      continue;
    }

    if (layer.type === 'symbol') {
      if (src === 'poi' || src === 'housenumber' || src === 'aerodrome_label' || id.includes('poi')) {
        hide();
        continue;
      }
      if (src === 'transportation_name' || id.includes('road') || id.includes('highway')) {
        set('text-color', C.labelFaint);
        set('text-halo-color', C.land);
        continue;
      }
      if (src === 'water_name' || id.includes('water')) {
        set('text-color', '#8a9795');
        set('text-halo-color', C.water);
        continue;
      }
      set('text-color', C.label);
      set('text-halo-color', C.land);
      set('text-halo-width', 1.2);
      continue;
    }

    if (src === 'water' || id === 'water') {
      set('fill-color', C.water);
      set('fill-outline-color', C.water);
      continue;
    }
    if (src === 'waterway') {
      set('line-color', C.waterDeep);
      continue;
    }
    if (src === 'park' || id.includes('park') || id.includes('wood') || id.includes('grass')) {
      set('fill-color', C.green);
      set('fill-outline-color', C.green);
      set('fill-opacity', 0.9);
      continue;
    }
    if (src === 'landcover') {
      if (id.includes('ice') || id.includes('glacier') || id.includes('sand')) {
        hide();
      } else {
        set('fill-color', C.green);
        set('fill-opacity', 0.55);
      }
      continue;
    }
    if (src === 'landuse') {
      set('fill-color', C.built);
      set('fill-opacity', 0.7);
      continue;
    }
    if (src === 'building') {
      set('fill-color', C.built);
      set('fill-outline-color', C.builtLine);
      set('fill-opacity', 0.85);
      continue;
    }
    if (src === 'transportation') {
      if (layer.type === 'line') {
        const major = /motorway|trunk|primary|secondary|major/.test(id);
        set('line-color', major ? C.roadMajor : C.road);
        if (id.includes('casing') || id.includes('outline')) hide();
      } else {
        set('fill-color', C.road);
      }
      continue;
    }
    if (src === 'boundary') {
      set('line-color', C.rule);
      set('line-dasharray', [3, 3]);
      continue;
    }
    if (src === 'aeroway') {
      set(layer.type === 'line' ? 'line-color' : 'fill-color', C.built);
      continue;
    }
  }
}
