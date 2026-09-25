import type { CSSProperties } from 'react';
import { CATEGORIES, type CategoryKey, type Glyph, type Importance } from '@locus/shared';

/**
 * One stroke-only geometric family on a 12px grid.
 * Fill = must-have, stroke = nice-to-have, faded = don't care.
 * Hollow + dashed = "no equivalent here" on a recreated routine.
 */

export type GlyphMode = 'fill' | 'stroke' | 'faint' | 'missing';

export function importanceToMode(importance: Importance): GlyphMode {
  if (importance === 'must') return 'fill';
  if (importance === 'nice') return 'stroke';
  return 'faint';
}

export const GLYPH_SIZE: Record<GlyphMode, number> = {
  fill: 12,
  stroke: 9,
  faint: 6,
  missing: 12,
};

interface Props {
  glyph: Glyph;
  mode?: GlyphMode;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** When nested inside another SVG: top-left position in parent units. */
  x?: number;
  y?: number;
}

export function GlyphIcon({ glyph, mode = 'stroke', size, color = 'currentColor', className, style, title, x, y }: Props) {
  const px = size ?? GLYPH_SIZE[mode];
  const filled = mode === 'fill';
  const opacity = mode === 'faint' ? 0.4 : 1;
  const dash = mode === 'missing' ? '2 1.5' : undefined;

  return (
    <svg
      x={x}
      y={y}
      width={px}
      height={px}
      viewBox="0 0 12 12"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', opacity, overflow: 'visible', ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {renderShape(glyph, { stroke: color, fill: filled ? color : 'none', sw: 1.25, dash })}
    </svg>
  );
}

type P = { stroke: string; fill: string; sw: number; dash?: string };

function renderShape(glyph: Glyph, p: P) {
  const filled = p.fill !== 'none';
  const common = {
    stroke: p.stroke,
    strokeWidth: p.sw,
    fill: p.fill,
    strokeDasharray: p.dash,
    strokeLinejoin: 'miter' as const,
    strokeLinecap: 'butt' as const,
    vectorEffect: 'non-scaling-stroke' as const,
  };
  const line = { stroke: p.stroke, strokeWidth: p.sw, strokeDasharray: p.dash, fill: 'none' };
  switch (glyph) {
    case 'square':
      return <rect x="1.5" y="1.5" width="9" height="9" {...common} />;
    case 'rect':
      return <rect x="1" y="3.5" width="10" height="5" {...common} />;
    case 'double-square':
      return (
        <>
          <rect x="1" y="1" width="7" height="7" {...common} fill={filled ? p.fill : 'none'} />
          <rect x="4" y="4" width="7" height="7" {...common} fill="none" />
        </>
      );
    case 'grid':
      return (
        <>
          <rect x="1.5" y="1.5" width="9" height="9" {...common} fill="none" />
          <path d="M6 1.5v9M1.5 6h9" {...line} />
          {filled ? <rect x="1.5" y="1.5" width="4.5" height="4.5" fill={p.fill} /> : null}
          {filled ? <rect x="6" y="6" width="4.5" height="4.5" fill={p.fill} /> : null}
        </>
      );
    case 'hexagon':
      return <polygon points="6,1 10.33,3.5 10.33,8.5 6,11 1.67,8.5 1.67,3.5" {...common} />;
    case 'pentagon':
      return <polygon points="6,1 10.75,4.45 8.94,10.05 3.06,10.05 1.25,4.45" {...common} />;
    case 'cross':
      return <path d="M6 1.5v9M1.5 6h9" stroke={p.stroke} strokeWidth={filled ? p.sw * 2.2 : p.sw * 1.4} strokeDasharray={p.dash} fill="none" />;
    case 'x':
      return <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke={p.stroke} strokeWidth={filled ? p.sw * 2 : p.sw * 1.3} strokeDasharray={p.dash} fill="none" />;
    case 'cross-circle':
      return (
        <>
          {filled ? <circle cx="6" cy="6" r="4.75" fill={p.fill} opacity="0.25" /> : null}
          <circle cx="6" cy="6" r="4.75" {...common} fill="none" />
          <path d="M6 3.2v5.6M3.2 6h5.6" stroke={p.stroke} strokeWidth={filled ? p.sw * 1.5 : p.sw} strokeDasharray={p.dash} />
        </>
      );
    case 'cross-square':
      return (
        <>
          <rect x="1.5" y="1.5" width="9" height="9" {...common} fill={filled ? p.fill : 'none'} />
          <path d="M6 3.2v5.6M3.2 6h5.6" stroke={filled ? 'var(--paper)' : p.stroke} strokeWidth={p.sw * 1.4} strokeDasharray={p.dash} />
        </>
      );
    case 'diamond':
      return <polygon points="6,1 11,6 6,11 1,6" {...common} />;
    case 'diamond-dot':
      return (
        <>
          <polygon points="6,1 11,6 6,11 1,6" {...common} fill="none" />
          <circle cx="6" cy="6" r={filled ? 2 : 1.2} fill={p.stroke} />
        </>
      );
    case 'tree':
      return (
        <>
          <circle cx="6" cy="4.5" r="3.5" {...common} />
          <path d="M6 8v3.5" {...line} strokeWidth={p.sw * 1.3} />
        </>
      );
    case 'ring':
      return <circle cx="6" cy="6" r="4" {...common} fill="none" strokeWidth={filled ? p.sw * 2.4 : p.sw} />;
    case 'dot':
      return <circle cx="6" cy="6" r="4" {...common} />;
    case 'half-circle':
      return (
        <>
          <path d="M1.5 8.5a4.5 4.5 0 0 1 9 0z" {...common} />
          <path d="M1.5 8.5h9" {...line} />
        </>
      );
    case 'crescent':
      return <path d="M8.5 1.6A5 5 0 1 0 10.4 8.2 4 4 0 1 1 8.5 1.6z" {...common} />;
    case 'bars':
      return (
        <>
          <rect x="1.5" y="3" width="9" height="2" {...common} />
          <rect x="1.5" y="7" width="9" height="2" {...common} />
        </>
      );
    case 'chevron':
      return <polyline points="2,8.5 6,3.5 10,8.5" {...line} strokeWidth={filled ? p.sw * 2.2 : p.sw * 1.3} strokeLinejoin="miter" />;
    case 'teardrop':
      return <path d="M6 1.2C7.6 3.8 9.6 5.6 9.6 7.6a3.6 3.6 0 1 1-7.2 0C2.4 5.6 4.4 3.8 6 1.2z" {...common} />;
    case 'triangle-small':
      return <polygon points="6,3 9.5,9.5 2.5,9.5" {...common} />;
    case 'triangle':
      return <polygon points="6,1.5 10.75,10.25 1.25,10.25" {...common} />;
    case 'triangle-base':
      return (
        <>
          <polygon points="6,1.2 10.5,8.2 1.5,8.2" {...common} />
          <path d="M1 10.8h10" {...line} />
        </>
      );
    case 'asterisk':
      return (
        <path
          d="M6 1v10M1.67 3.5l8.66 5M1.67 8.5l8.66-5"
          stroke={p.stroke}
          strokeWidth={filled ? p.sw * 1.6 : p.sw}
          strokeDasharray={p.dash}
          fill="none"
        />
      );
    case 'quad':
      return (
        <>
          <circle cx="3.5" cy="3.5" r="1.8" {...common} />
          <circle cx="8.5" cy="3.5" r="1.8" {...common} />
          <circle cx="3.5" cy="8.5" r="1.8" {...common} />
          <circle cx="8.5" cy="8.5" r="1.8" {...common} />
        </>
      );
  }
}

export function CategoryGlyph(props: Omit<Props, 'glyph'> & { category: CategoryKey }) {
  const { category, ...rest } = props;
  return <GlyphIcon glyph={CATEGORIES[category].glyph} title={rest.title ?? CATEGORIES[category].label} {...rest} />;
}

/** Home: the only filled accent ring in the product. */
export function HomeGlyph({
  size = 16,
  color = 'var(--ballpoint)',
  ring = false,
  x,
  y,
}: {
  size?: number;
  color?: string;
  ring?: boolean;
  x?: number;
  y?: number;
}) {
  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
      aria-label="Home"
      role="img"
    >
      {ring ? <circle cx="8" cy="8" r="7.25" fill="none" stroke={color} strokeWidth="1" opacity="0.35" /> : null}
      <circle cx="8" cy="8" r="5.5" fill="var(--paper)" stroke={color} strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2.75" fill={color} />
    </svg>
  );
}
