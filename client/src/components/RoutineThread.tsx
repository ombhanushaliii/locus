import { CATEGORIES, routineLabel, type CategoryKey, type RoutineNode } from '@locus/shared';
import { GlyphIcon, HomeGlyph } from '../atlas/glyphs';
import type { ThreadNode } from '../lib/geo';

interface Props {
  nodes: ThreadNode[] | RoutineNode[];
  size?: 'm' | 's';
  onToggle?: (node: RoutineNode) => void;
  dropped?: RoutineNode[];
}

function isThreadNodes(n: Props['nodes']): n is ThreadNode[] {
  return n.length > 0 && typeof n[0] === 'object';
}

export function RoutineThread({ nodes, size = 'm', onToggle, dropped = [] }: Props) {
  const items: ThreadNode[] = isThreadNodes(nodes) ? nodes : (nodes as RoutineNode[]).map((node) => ({ node, point: { lat: 0, lng: 0 } }));
  return (
    <ol className={`routine routine--${size}`} aria-label="Your routine">
      {items.map((n, i) => {
        const missing = n.point === null;
        const label = routineLabel(n.node);
        const glyph =
          n.node === 'home' ? (
            <HomeGlyph size={size === 'm' ? 14 : 10} />
          ) : n.node === 'anchor' ? (
            <GlyphIcon glyph="square" mode={missing ? 'missing' : 'stroke'} size={size === 'm' ? 11 : 8} color="var(--ballpoint)" />
          ) : (
            <GlyphIcon glyph={CATEGORIES[n.node as CategoryKey].glyph} mode={missing ? 'missing' : 'fill'} size={size === 'm' ? 11 : 8} color={missing ? 'var(--ink-soft)' : 'var(--ballpoint)'} />
          );
        const canToggle = onToggle && n.node !== 'home';
        const isDropped = dropped.includes(n.node);
        return (
          <li key={`${n.node}-${i}`} className={`routine__node${missing ? ' is-missing' : ''}${isDropped ? ' is-dropped' : ''}`}>
            {i > 0 ? <span className="routine__arrow" aria-hidden>→</span> : null}
            {canToggle ? (
              <button type="button" className="routine__btn" onClick={() => onToggle(n.node)} title={isDropped ? 'Put back' : 'Leave out of routine'}>
                {glyph}
                <span>{label}</span>
              </button>
            ) : (
              <span className="routine__btn routine__btn--static">
                {glyph}
                <span>{label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
