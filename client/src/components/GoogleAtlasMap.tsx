import { useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import type { LatLng } from '@locus/shared';
import { MAPS_BROWSER_KEY, MAPS_MAP_ID } from '../api';
import { ATLAS_MAP_STYLE, MAP_DEFAULTS } from '../atlas/mapStyle';
import { AtlasLayer, type AtlasProps, type Projector } from './AtlasLayer';

/** Web Mercator: metres per pixel at zoom 0, equator. */
const EQUATOR_M_PER_PX_Z0 = 156543.03392;
const WORLD_PX_Z0 = 256;

function zoomForSpan(center: LatLng, spanM: number, w: number, h: number): number {
  const mPerPx = (2 * spanM) / Math.min(w, h);
  return Math.log2((EQUATOR_M_PER_PX_Z0 * Math.cos((center.lat * Math.PI) / 180)) / mPerPx);
}

/**
 * Google-backed atlas: the real map underneath, the same SVG layer on top.
 * Camera follows `center` + `spanM`; the layer re-projects on every camera change.
 */
export function GoogleAtlasMap(props: AtlasProps) {
  const { center, dim, className, onSelectPlace } = props;
  const [ready, setReady] = useState(false);
  return (
    <div className={`papermap papermap--google${dim ? ' papermap--dim' : ''}${className ? ` ${className}` : ''}`}>
      <APIProvider apiKey={MAPS_BROWSER_KEY} onLoad={() => setReady(true)}>
        <Map
          style={{ position: 'absolute', inset: 0 }}
          defaultCenter={center}
          defaultZoom={14}
          {...MAP_DEFAULTS}
          isFractionalZoomEnabled
          colorScheme="LIGHT"
          {...(MAPS_MAP_ID ? { mapId: MAPS_MAP_ID } : { styles: ATLAS_MAP_STYLE })}
          onClick={() => onSelectPlace?.(null)}
        />
        {ready ? <Overlay {...props} /> : null}
      </APIProvider>
    </div>
  );
}

function Overlay(props: AtlasProps) {
  const { center, spanM, children } = props;
  const map = useMap();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!map) return;
    const bump = () => setTick((t) => t + 1);
    const listeners = ['bounds_changed', 'idle', 'projection_changed', 'resize'].map((ev) => map.addListener(ev, bump));
    const ro = new ResizeObserver(bump);
    ro.observe(map.getDiv());
    return () => {
      listeners.forEach((l) => l.remove());
      ro.disconnect();
    };
  }, [map]);

  /* Camera follows props. */
  useEffect(() => {
    if (!map) return;
    const div = map.getDiv();
    const w = div.clientWidth;
    const h = div.clientHeight;
    if (!w || !h) return;
    map.moveCamera({ center, zoom: zoomForSpan(center, spanM, w, h) });
  }, [map, center.lat, center.lng, spanM]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = useMemo<Projector | null>(() => {
    if (!map) return null;
    const proj = map.getProjection();
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    if (!proj || !bounds || zoom == null) return null;
    const div = map.getDiv();
    const w = div.clientWidth;
    const h = div.clientHeight;
    const scale = 2 ** zoom;
    const nw = proj.fromLatLngToPoint(new google.maps.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng()));
    if (!nw) return null;
    const fn = ((p: LatLng) => {
      const pt = proj.fromLatLngToPoint(new google.maps.LatLng(p.lat, p.lng));
      return pt ? { x: (pt.x - nw.x) * scale, y: (pt.y - nw.y) * scale } : { x: -9999, y: -9999 };
    }) as Projector;
    const latRad = (map.getCenter()?.lat() ?? 0) * (Math.PI / 180);
    fn.scale = (scale * WORLD_PX_Z0) / (2 * Math.PI * 6378137 * Math.cos(latRad));
    fn.width = w;
    fn.height = h;
    return fn;
    // tick forces re-projection after camera moves
  }, [map, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null;
  return (
    <>
      <AtlasLayer {...props} project={project} />
      {children ? <div className="papermap__overlay">{children(project)}</div> : null}
    </>
  );
}
