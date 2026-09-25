import { useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng } from '@locus/shared';
import { STYLE_URL, applyAtlasPaint } from '../atlas/mapStyle';
import { AtlasLayer, type AtlasProps, type Projector } from './AtlasLayer';

// MapLibre 6 loads its worker as a separate module; let Vite bundle and serve it.
setWorkerUrl(maplibreWorkerUrl);

/** Web Mercator, 512px tiles (MapLibre convention). */
const EARTH_CIRC_M = 40_075_016.686;
const TILE_PX = 512;

function zoomForSpan(center: LatLng, spanM: number, w: number, h: number): number {
  const mPerPx = (2 * spanM) / Math.min(w, h);
  return Math.log2((EARTH_CIRC_M * Math.cos((center.lat * Math.PI) / 180)) / (TILE_PX * mPerPx));
}

function pxPerMeter(map: MapLibreMap): number {
  const lat = map.getCenter().lat;
  const mPerPx = (EARTH_CIRC_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * 2 ** map.getZoom());
  return 1 / mPerPx;
}

/**
 * The real map underneath (keyless vector tiles, repainted to the atlas palette),
 * the same SVG layer on top. Until tiles arrive the layer draws its own paper.
 */
export function LibreAtlasMap(props: AtlasProps) {
  const { center, spanM, dim, className, onSelectPlace, children } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const node = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = node.current;
    const w0 = el?.clientWidth ?? 0;
    const h0 = el?.clientHeight ?? 0;
    if (!el) return;
    const map = new MapLibreMap({
      container: el,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom: w0 && h0 ? zoomForSpan(center, spanM, w0, h0) : 14,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __locusMap?: MapLibreMap }).__locusMap = map;

    const bump = () => setTick((t) => t + 1);
    map.on('move', bump);
    map.on('resize', bump);
    map.on('load', () => {
      applyAtlasPaint(map);
      setLoaded(true);
      bump();
    });
    map.on('error', (e) => {
      // Tiles or style unavailable: stay on paper, but keep projecting.
      console.warn('basemap: ' + (e.error?.message ?? 'unavailable') + ' (drawing on paper)');
    });
    map.on('click', () => onSelectPlace?.(null));

    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      map.resize();
    });
    ro.observe(el);
    setSize({ w: w0, h: h0 });

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; camera and layer follow props below.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Camera follows props. */
  const first = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !size.w || !size.h) return;
    const zoom = zoomForSpan(center, spanM, size.w, size.h);
    if (first.current) {
      map.jumpTo({ center: [center.lng, center.lat], zoom });
      first.current = false;
    } else {
      map.easeTo({ center: [center.lng, center.lat], zoom, duration: 600 });
    }
  }, [center.lat, center.lng, spanM, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = useMemo<Projector | null>(() => {
    const map = mapRef.current;
    if (!map || !size.w || !size.h) return null;
    const fn = ((p: LatLng) => {
      const pt = map.project([p.lng, p.lat]);
      return { x: pt.x, y: pt.y };
    }) as Projector;
    fn.scale = pxPerMeter(map);
    fn.width = size.w;
    fn.height = size.h;
    return fn;
    // tick re-projects after every camera move
  }, [size, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className={`papermap papermap--libre${loaded ? ' is-loaded' : ''}${dim ? ' papermap--dim' : ''}${className ? ` ${className}` : ''}`}>
      <div ref={node} className="papermap__basemap" />
      {project ? (
        <>
          <AtlasLayer {...props} project={project} background={!loaded} />
          {children ? <div className="papermap__overlay">{children(project)}</div> : null}
        </>
      ) : null}
    </div>
  );
}
