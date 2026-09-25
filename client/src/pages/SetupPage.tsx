import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { byFamily, CATEGORIES, CATEGORY_KEYS, type CategoryKey, type Importance } from '@locus/shared';
import { CategoryGlyph, importanceToMode } from '../atlas/glyphs';
import { AtlasMap, type PaperPlace } from '../components/AtlasMap';
import { RoutineThread } from '../components/RoutineThread';
import { buildThread, formatKm, metersBetween } from '../lib/geo';
import { useLocus } from '../state';

const IMPORTANCE: { key: Importance; label: string }[] = [
  { key: 'must', label: 'Must' },
  { key: 'nice', label: 'Nice' },
  { key: 'none', label: 'Skip' },
];

export function SetupPage() {
  const { state, dispatch, derived } = useLocus();
  const nav = useNavigate();
  const [hover, setHover] = useState<CategoryKey | null>(null);
  const [selected, setSelected] = useState<PaperPlace | null>(null);

  const baseline = state.baseline;
  const home = baseline?.home ?? { lat: 0, lng: 0, label: '', localityLabel: '', cityId: '' };
  const anchor = baseline?.anchor;
  const sparse = baseline?.sparse ?? false;

  const places: PaperPlace[] = useMemo(
    () => derived.places.map((p) => ({ id: `${p.placeId}:${p.category}`, lat: p.lat, lng: p.lng, category: p.category, mode: importanceToMode(state.importance[p.category]) })),
    [derived.places, state.importance],
  );
  const placeById = useMemo(() => new Map(derived.places.map((p) => [`${p.placeId}:${p.category}`, p])), [derived.places]);

  const thread = useMemo(() => buildThread(derived.routine, home, anchor, derived.places), [derived.routine, home, anchor, derived.places]);

  const spanM = useMemo(() => {
    const base = 2200;
    if (!anchor || anchor.lat === 0) return base;
    const d = metersBetween(home, anchor);
    return d > 12_000 ? base : Math.max(base, d * 1.15);
  }, [home, anchor]);

  /* Lens readout: what fits inside the ring right now. */
  const lens = useMemo(() => {
    const inside = derived.places.filter((p) => metersBetween(home, p) <= state.lensM);
    const byCat = new Map<CategoryKey, number>();
    for (const p of inside) byCat.set(p.category, (byCat.get(p.category) ?? 0) + 1);
    const mustKeys = CATEGORY_KEYS.filter((k) => state.importance[k] === 'must');
    const mustTotal = mustKeys.reduce((s, k) => s + derived.counts[k], 0);
    const mustInside = mustKeys.reduce((s, k) => s + (byCat.get(k) ?? 0), 0);
    const parts = [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${n} ${CATEGORIES[k].label.toLowerCase()}`);
    return { parts, pct: mustTotal ? Math.round((100 * mustInside) / mustTotal) : 0 };
  }, [derived.places, derived.counts, home, state.lensM, state.importance]);

  const removedCount = state.removedPlaceIds.length;
  const selectedPlace = selected ? placeById.get(selected.id) : undefined;

  if (!baseline || !state.city) return <Navigate to="/" replace />;

  return (
    <section className="setup">
      <div className="setup__map">
        <AtlasMap
          center={home}
          spanM={spanM}
          home={home}
          anchor={anchor && anchor.lat !== 0 && metersBetween(home, anchor) <= 12_000 ? anchor : null}
          places={places}
          hoverCategory={hover}
          selectedId={selected?.id ?? null}
          onSelectPlace={setSelected}
          lensM={state.lensM}
          onLensChange={(m) => dispatch({ type: 'setLens', lensM: m })}
          thread={thread}
          spokes
        >
          {(project) =>
            selected && selectedPlace ? (
              (() => {
                const q = project(selected);
                return (
                  <div className="callout" style={{ left: q.x, top: q.y }} role="dialog" aria-label="Place">
                    <span className="callout__name">{selectedPlace.name}</span>
                    <span className="callout__row">
                      <CategoryGlyph category={selected.category} mode="fill" size={11} color="var(--ballpoint)" />
                      <span className="meta meta--ink">{CATEGORIES[selected.category].label}</span>
                      <span className="meta">· {formatKm(selectedPlace.distanceM)}</span>
                    </span>
                    <button
                      type="button"
                      className="action action--quiet callout__remove"
                      onClick={() => {
                        dispatch({ type: 'removePlace', placeId: selectedPlace.placeId });
                        setSelected(null);
                      }}
                    >
                      Not mine ×
                    </button>
                  </div>
                );
              })()
            ) : null
          }
        </AtlasMap>
        <p className="setup__mapnote meta">Counts use each category’s reach (walk · ride · drive). The ring is a lens, not a setting.</p>
      </div>

      <aside className="setup__col">
        <p className="meta">Your current setup · {home.localityLabel}</p>
        <h1 className="display display--m setup__h">Let’s see how well your life translates.</h1>
        <p className="setup__lead body-soft">
          These are the named places within reach of {home.localityLabel}. Mark what matters, skip what doesn’t, and remove anything that isn’t part of your life.
        </p>

        <p className="setup__lens">
          <span className="meta meta--accent">Within {formatKm(state.lensM)}</span>
          <span>
            {lens.parts.length ? lens.parts.join(', ') : 'nothing yet'} · <strong>{lens.pct}%</strong> of your must-haves
          </span>
        </p>

        <hr className="rule rule--strong" />
        {byFamily().map((fam) => (
          <div key={fam.family} className="ledger-group">
            <p className="meta ledger-group__title">{fam.label}</p>
            <ul className="ledger" aria-label={fam.label}>
              {fam.keys.map((k) => {
                const imp = state.importance[k];
                return (
                  <li key={k} className={`ledger__row${imp === 'none' ? ' is-skipped' : ''}`} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
                    <span className="ledger__glyph">
                      <CategoryGlyph category={k} mode={importanceToMode(imp)} size={12} color={imp === 'must' ? 'var(--ballpoint)' : 'var(--ink)'} />
                    </span>
                    <span className="ledger__label">{CATEGORIES[k].label}</span>
                    <span className="ledger__count numeral">{derived.counts[k]}</span>
                    <span className="ledger__imp" role="radiogroup" aria-label={`${CATEGORIES[k].label} importance`}>
                      {IMPORTANCE.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          role="radio"
                          aria-checked={imp === o.key}
                          className={`imp${imp === o.key ? ' is-on' : ''}`}
                          onClick={() => dispatch({ type: 'setImportance', category: k, importance: o.key })}
                        >
                          {o.label}
                        </button>
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <hr className="rule rule--strong" />

        {removedCount > 0 ? (
          <p className="setup__removed meta">
            Removed {removedCount} ·{' '}
            <button type="button" className="action action--quiet" onClick={() => dispatch({ type: 'undoRemove' })}>
              undo
            </button>
          </p>
        ) : null}

        {sparse ? <p className="display display--i setup__sparse">Your area is quiet, so there’s less to compare against. Matches will be lenient.</p> : null}

        <p className="meta setup__routineLabel">Your routine</p>
        <RoutineThread nodes={thread} onToggle={(n) => dispatch({ type: 'toggleRoutineNode', node: n })} dropped={state.droppedRoutineNodes} />
        <p className="meta setup__hint">Must-haves become stops. Click a stop to leave it out.</p>

        <div className="setup__go">
          <button type="button" className="action" onClick={() => nav('/match')}>
            Translate to {state.city.name} <span aria-hidden>→</span>
          </button>
        </div>
      </aside>
    </section>
  );
}
