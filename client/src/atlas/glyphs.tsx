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

function renderShape(glyph: Glyph, p: { stroke: string; fill: string; sw: number; dash?: string }) {
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
  switch (glyph) {
    case 'square':
      return <rect x="1.5" y="1.5" width="9" height="9" {...common} />;
    case 'hexagon':
      return <polygon points="6,1 10.33,3.5 10.33,8.5 6,11 1.67,8.5 1.67,3.5" {...common} />;
    case 'cross-circle':
      return (
        <>
          {filled ? <circle cx="6" cy="6" r="4.75" fill={p.fill} opacity="0.25" /> : null}
          <circle cx="6" cy="6" r="4.75" {...common} fill="none" />
          <path d="M6 3.2v5.6M3.2 6h5.6" stroke={p.stroke} strokeWidth={filled ? p.sw * 1.5 : p.sw} strokeDasharray={p.dash} />
        </>
      );
    case 'diamond':
      return <polygon points="6,1 11,6 6,11 1,6" {...common} />;
    case 'dot':
      return <circle cx="6" cy="6" r="4" {...common} />;
    case 'bars':
      return (
        <>
          <rect x="1.5" y="3" width="9" height="2" {...common} />
          <rect x="1.5" y="7" width="9" height="2" {...common} />
        </>
      );
    case 'triangle':
      return <polygon points="6,1.5 10.75,10.25 1.25,10.25" {...common} />;
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
    case 'half-circle':
      return (
        <>
          <circle cx="6" cy="6" r="4.75" {...common} fill="none" />
          <path d="M6 1.25a4.75 4.75 0 0 1 0 9.5z" fill={p.stroke} opacity={filled ? 1 : 0.55} />
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
