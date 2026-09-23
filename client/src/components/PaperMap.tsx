import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CATEGORIES, type CategoryKey, type LatLng, type Viewport } from '@locus/shared';
import { CategoryGlyph, GlyphIcon, HomeGlyph, type GlyphMode } from '../atlas/glyphs';
import { toLocalMeters, type ThreadNode } from '../lib/geo';

/**
 * The atlas surface, drawn in SVG from coordinates alone.
 * Used when no Google Maps browser key is configured; the Google-backed map
 * (M3) shares the same props so pages don't care which one they get.
 */

export interface PaperPlace extends LatLng {
  id: string;
  category: CategoryKey;
  mode: GlyphMode;
}

export interface Outline {
  id: number;
  name: string;
  viewport: Viewport;
  emphasis: 'strong' | 'normal' | 'faint';
}

export interface Projector {
  (p: LatLng): { x: number; y: number };
  scale: number; // px per metre
  width: number;
  height: number;
}

interface Props {
  center: LatLng;
  /** Half-extent, in metres, that must fit inside the shorter side. */
  spanM: number;
  home?: LatLng | null;
  anchor?: LatLng | null;
  places?: PaperPlace[];
  hoverCategory?: CategoryKey | null;
  selectedId?: string | null;
  onSelectPlace?: (p: PaperPlace | null) => void;
  lensM?: number;
  onLensChange?: (m: number) => void;
  thread?: ThreadNode[];
  spokes?: boolean;
  outlines?: Outline[];
  onOutlineClick?: (id: number) => void;
  onOutlineHover?: (id: number | null) => void;
  drawThread?: boolean;
  dim?: boolean;
  className?: string;
  children?: (project: Projector) => ReactNode;
}

export function PaperMap({
  center,
  spanM,
  home,
  anchor,
  places = [],
  hoverCategory,
  selectedId,
  onSelectPlace,
  lensM,
  onLensChange,
  thread,
  spokes,
  outlines = [],
  onOutlineClick,
  onOutlineHover,
  drawThread,
  dim,
  className,
  children,
}: Props) {
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

  /* ---- lens drag ---- */
  const dragging = useRef(false);
  const onLensPointer = useCallback(
    (e: React.PointerEvent) => {
      if (!home || !onLensChange || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const hp = project(home);
      const dx = e.clientX - rect.left - hp.x;
      const dy = e.clientY - rect.top - hp.y;
      const m = Math.hypot(dx, dy) / project.scale;
      onLensChange(Math.max(200, Math.min(4000, Math.round(m / 50) * 50)));
    },
    [home, onLensChange, project],
  );

  useEffect(() => {
    if (!onLensChange) return;
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      onLensPointer(e as unknown as React.PointerEvent);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [onLensPointer, onLensChange]);

  const gridPx = Math.max(24, 250 * project.scale);
  const homePx = home ? project(home) : null;
  const anchorPx = anchor ? project(anchor) : null;

  /* ---- thread geometry ---- */
  const threadPts = useMemo(() => {
    if (!thread) return [];
    const pts: { x: number; y: number; missing: boolean; node: ThreadNode['node'] }[] = [];
    thread.forEach((n, i) => {
      if (n.point) {
        const p = project(n.point);
        pts.push({ ...p, missing: false, node: n.node });
      } else {
        // Missing node: float it off the midpoint of its neighbours, hollow and dashed.
        const prev = [...thread.slice(0, i)].reverse().find((t) => t.point)?.point;
        const next = thread.slice(i + 1).find((t) => t.point)?.point;
        const a = prev ? project(prev) : { x: project.width / 2, y: project.height / 2 };
        const b = next ? project(next) : a;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const off = 56;
        pts.push({ x: mx - (dy / len) * off, y: my + (dx / len) * off, missing: true, node: n.node });
      }
    });
    return pts;
  }, [thread, project]);

  return (
    <div ref={ref} className={`papermap${dim ? ' papermap--dim' : ''}${className ? ` ${className}` : ''}`}>
      <svg className="papermap__svg" width={size.w} height={size.h} onClick={() => onSelectPlace?.(null)}>
        <defs>
          <pattern id="graticule" width={gridPx} height={gridPx} patternUnits="userSpaceOnUse" x={size.w / 2} y={size.h / 2}>
            <path d={`M ${gridPx} 0 L 0 0 0 ${gridPx}`} fill="none" stroke="rgba(35,35,35,0.07)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill="var(--map-land)" />
        <rect width={size.w} height={size.h} fill="url(#graticule)" />

        {/* Locality outlines */}
        {outlines.map((o) => {
          const a = project(o.viewport.sw);
          const b = project(o.viewport.ne);
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const w = Math.abs(b.x - a.x);
          const h = Math.abs(b.y - a.y);
          return (
            <g
              key={o.id}
              className={`outline outline--${o.emphasis}`}
              onClick={(e) => {
                e.stopPropagation();
                onOutlineClick?.(o.id);
              }}
              onMouseEnter={() => onOutlineHover?.(o.id)}
              onMouseLeave={() => onOutlineHover?.(null)}
              role={onOutlineClick ? 'button' : undefined}
              tabIndex={onOutlineClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOutlineClick?.(o.id);
              }}
            >
              <rect x={x} y={y} width={w} height={h} />
              <text x={x + 10} y={y + h - 12} className="outline__label">
                {o.name}
              </text>
            </g>
          );
        })}

        {/* Spokes: home to each must-have place */}
        {spokes && homePx
          ? places
              .filter((p) => p.mode === 'fill')
              .map((p) => {
                const q = project(p);
                return <line key={`s-${p.id}`} x1={homePx.x} y1={homePx.y} x2={q.x} y2={q.y} className="spoke" />;
              })
          : null}

        {/* Radius lens */}
        {homePx && lensM ? (
          <g className="lens">
            <circle cx={homePx.x} cy={homePx.y} r={lensM * project.scale} className="lens__ring" />
            {onLensChange ? (
              <circle
                cx={homePx.x + lensM * project.scale * Math.SQRT1_2}
                cy={homePx.y - lensM * project.scale * Math.SQRT1_2}
                r={7}
                className="lens__handle"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragging.current = true;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragging.current) onLensPointer(e);
                }}
                onPointerUp={() => {
                  dragging.current = false;
                }}
                role="slider"
                aria-label="Radius around home"
                aria-valuenow={lensM}
                aria-valuemin={200}
                aria-valuemax={4000}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onLensChange(Math.min(4000, lensM + 100));
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onLensChange(Math.max(200, lensM - 100));
                }}
              />
            ) : null}
            <text
              x={homePx.x + lensM * project.scale * Math.SQRT1_2 + 12}
              y={homePx.y - lensM * project.scale * Math.SQRT1_2 + 4}
              className="lens__label"
            >
              {lensM >= 1000 ? `${(lensM / 1000).toFixed(1)} km` : `${lensM} m`}
            </text>
          </g>
        ) : null}

        {/* Places */}
        {places.map((p) => {
          const q = project(p);
          const hovered = hoverCategory === p.category;
          const selected = selectedId === p.id;
          const size = p.mode === 'fill' ? 12 : p.mode === 'stroke' ? 9 : 6;
          const s = hovered || selected ? size + 4 : size;
          return (
            <g
              key={p.id}
              className={`place${hovered ? ' is-hover' : ''}${selected ? ' is-selected' : ''}${hoverCategory && !hovered ? ' is-muted' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPlace?.(p);
              }}
              role={onSelectPlace ? 'button' : undefined}
              tabIndex={onSelectPlace ? 0 : undefined}
              aria-label={CATEGORIES[p.category].label}
            >
              <circle cx={q.x} cy={q.y} r={s} fill="transparent" />
              <CategoryGlyph category={p.category} mode={p.mode} size={s} x={q.x - s / 2} y={q.y - s / 2} color={p.mode === 'fill' ? 'var(--ballpoint)' : 'var(--ink)'} />
            </g>
          );
        })}

        {/* Routine thread */}
        {threadPts.length > 1 ? (
          <g className={`thread${drawThread ? ' thread--draw' : ''}`}>
            {threadPts.slice(1).map((b, i) => {
              const a = threadPts[i]!;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={`thread__seg${a.missing || b.missing ? ' is-missing' : ''}`}
                  pathLength={1}
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              );
            })}
            {threadPts.map((p, i) =>
              p.missing ? (
                <g key={`m-${i}`} className="thread__missing">
                  <GlyphIcon glyph={p.node === 'anchor' ? 'square' : CATEGORIES[p.node as CategoryKey].glyph} mode="missing" size={14} x={p.x - 7} y={p.y - 7} color="var(--ink-soft)" />
                  <text x={p.x + 12} y={p.y + 4} className="thread__note">
                    none here
                  </text>
                </g>
              ) : null,
            )}
          </g>
        ) : null}

        {/* Anchor */}
        {anchorPx ? (
          <g className="anchor">
            <rect x={anchorPx.x - 6} y={anchorPx.y - 6} width={12} height={12} fill="var(--paper)" stroke="var(--ballpoint)" strokeWidth={1.5} />
            <text x={anchorPx.x + 12} y={anchorPx.y + 4} className="lens__label">
              WORK
            </text>
          </g>
        ) : null}

        {/* Home */}
        {homePx ? <HomeGlyph size={18} x={homePx.x - 9} y={homePx.y - 9} ring /> : null}
      </svg>
      {children ? <div className="papermap__overlay">{children(project)}</div> : null}
    </div>
  );
}
