import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LatLng } from '@locus/shared';
import { toLocalMeters } from '../lib/geo';
import { AtlasLayer, type AtlasProps, type Projector } from './AtlasLayer';

export type { AtlasProps, Outline, PaperPlace, Projector } from './AtlasLayer';

/**
 * The atlas surface drawn entirely in SVG from coordinates. Used in mock mode
 * (VITE_PAPER=1, or before tiles load); LibreAtlasMap shares the same props.
 */
export function PaperMap(props: AtlasProps) {
  const { center, spanM, dim, className, children } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const project = useMemo<Projector>(() => {
    const { w, h } = size;
    const scale = Math.min(w, h) / (2 * spanM) || 0;
    const fn = ((p: LatLng) => {
      const { east, north } = toLocalMeters(center, p);
      return { x: w / 2 + east * scale, y: h / 2 - north * scale };
    }) as Projector;
    fn.scale = scale;
    fn.width = w;
    fn.height = h;
    return fn;
  }, [center, spanM, size]);

  return (
    <div ref={ref} className={`papermap${dim ? ' papermap--dim' : ''}${className ? ` ${className}` : ''}`}>
      <AtlasLayer {...props} project={project} background />
      {children ? <div className="papermap__overlay">{children(project)}</div> : null}
    </div>
  );
}
