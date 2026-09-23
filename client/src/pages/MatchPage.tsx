import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CATEGORIES, CATEGORY_KEYS, displayOverall, isEquivalent, verdictLine, type MatchResult } from '@locus/shared';
import { fetchMatch } from '../api';
import { CategoryGlyph, importanceToMode } from '../atlas/glyphs';
import { AtlasMap, type Outline, type PaperPlace } from '../components/AtlasMap';
import { RangeStrip } from '../components/RangeStrip';
import { RoutineThread } from '../components/RoutineThread';
import { buildThread } from '../lib/geo';
import { useLocus } from '../state';

type Phase = 'translating' | 'done';

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TRANSLATE_MS = REDUCED ? 0 : 1900;

export function MatchPage() {
  const { state, dispatch, derived } = useLocus();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>(state.match ? 'done' : 'translating');
  const [error, setError] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  const baseline = state.baseline;
  const city = state.city;
  const startedAt = useRef(performance.now());

  useEffect(() => {
    if (!baseline || !city || state.match) return;
    let alive = true;
    fetchMatch({
      home: { lat: baseline.home.lat, lng: baseline.home.lng },
      anchor: baseline.anchor ? { lat: baseline.anchor.lat, lng: baseline.anchor.lng } : undefined,
      cityId: city.id,
      categories: derived.categories,
    })
      .then((m) => alive && dispatch({ type: 'setMatch', match: m }))
      .catch(() => alive && setError('The match did not come back. Try again in a moment.'));
    return () => {
      alive = false;
    };
  }, [baseline, city, state.match, derived.categories, dispatch]);

  /* Hold the translation on screen for its full length even when the match returns instantly. */
  useEffect(() => {
    if (!state.match || phase === 'done') return;
    const wait = Math.max(0, TRANSLATE_MS - (performance.now() - startedAt.current));
    const t = window.setTimeout(() => setPhase('done'), wait);
    return () => window.clearTimeout(t);
  }, [state.match, phase]);

  const match = state.match;
  const top = match?.results[0];
  const homePt = baseline?.home ?? { lat: 0, lng: 0 };
  const anchorPt = baseline?.anchor ?? null;

  /* Home scene (fades out) */
  const homePlaces: PaperPlace[] = useMemo(
    () => derived.places.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, category: p.category, mode: importanceToMode(state.importance[p.category]) })),
    [derived.places, state.importance],
  );
  const homeThread = useMemo(() => buildThread(derived.routine, homePt, anchorPt, derived.places), [derived.routine, homePt, anchorPt, derived.places]);

  /* Destination scene */
  const cityCenter = useMemo(() => {
    if (!match?.results.length) return homePt;
    const lat = match.results.reduce((s, r) => s + r.locality.center.lat, 0) / match.results.length;
    const lng = match.results.reduce((s, r) => s + r.locality.center.lng, 0) / match.results.length;
    return { lat, lng };
  }, [match, homePt]);

  const outlines: Outline[] = useMemo(
    () =>
      (match?.results ?? []).map((r, i) => ({
        id: r.locality.id,
        name: r.locality.name,
        viewport: r.locality.viewport,
        emphasis: hoverId === r.locality.id ? 'strong' : hoverId ? 'faint' : i === 0 ? 'strong' : 'normal',
      })),
    [match, hoverId],
  );

  const focus = useMemo(() => match?.results.find((r) => r.locality.id === (hoverId ?? top?.locality.id)) ?? top, [match, hoverId, top]);
  const focusThread = useMemo(
    () => (focus ? buildThread(derived.routine, focus.locality.center, anchorPt, focus.points) : []),
    [focus, derived.routine, anchorPt],
  );
  const focusPlaces: PaperPlace[] = useMemo(
    () =>
      (focus?.points ?? []).map((p, i) => ({
        id: `${focus!.locality.id}-${i}`,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        mode: state.importance[p.category] === 'must' ? 'fill' : state.importance[p.category] === 'nice' ? 'stroke' : 'faint',
      })),
    [focus, state.importance],
  );

  const spanM = useMemo(() => {
    if (!match?.results.length) return 2200;
    let max = 2200;
    for (const r of match.results) max = Math.max(max, Math.hypot((r.locality.center.lat - cityCenter.lat) * 111_320, (r.locality.center.lng - cityCenter.lng) * 111_320 * Math.cos((cityCenter.lat * Math.PI) / 180)) + 2600);
    return max;
  }, [match, cityCenter]);

  /* Compare mode */
  const compare = state.compare;
  const [cmpA, cmpB] = compare ? compare.map((id) => match?.results.find((r) => r.locality.id === id)) : [undefined, undefined];

  if (!baseline || !city) return <Navigate to="/" replace />;

  return (
    <section className={`match match--${phase}${compare ? ' match--compare' : ''}`}>
      <div className="match__map">
        {phase === 'translating' ? (
          <>
            <div className="scene scene--out">
              <AtlasMap center={baseline.home} spanM={2200} home={baseline.home} anchor={baseline.anchor} places={homePlaces} thread={homeThread} spokes />
            </div>
            {top ? (
              <div className="scene scene--in">
                <AtlasMap center={top.locality.center} spanM={2200} places={focusPlaces} thread={focusThread} drawThread />
              </div>
            ) : null}
            <p className="match__translating display display--m display--i">Translating your life to {city.name}…</p>
          </>
        ) : compare && cmpA && cmpB ? (
          <div className="split">
            {[cmpA, cmpB].map((r) => (
              <div key={r.locality.id} className="split__pane">
                <AtlasMap
                  center={r.locality.center}
                  spanM={2000}
                  places={r.points.map((p, i) => ({ id: `${r.locality.id}-${i}`, lat: p.lat, lng: p.lng, category: p.category, mode: importanceToMode(state.importance[p.category]) }))}
                  thread={buildThread(derived.routine, r.locality.center, baseline.anchor, r.points)}
                />
                <p className="split__name display display--s">{r.locality.name}</p>
              </div>
            ))}
          </div>
        ) : (
          <AtlasMap
            center={cityCenter}
            spanM={spanM}
            outlines={outlines}
            onOutlineClick={(id) => nav(`/match/${id}`)}
            onOutlineHover={setHoverId}
            places={focusPlaces}
            thread={focusThread}
          />
        )}
      </div>

      <aside className="match__col">
        {error ? (
          <p className="addresses__error">{error}</p>
        ) : !match || phase === 'translating' ? (
          <p className="meta">The match · {city.name}</p>
        ) : compare && cmpA && cmpB ? (
          <CompareColumn a={cmpA} b={cmpB} onClose={() => dispatch({ type: 'setCompare', compare: null })} />
        ) : (
          <>
            <p className="meta">The match · {city.name}</p>
            {match.equivalentFound ? (
              <h1 className="display display--m match__h">Your life translates well to {city.name}.</h1>
            ) : (
              <h1 className="display display--m match__h">No locality in {city.name} fully matches your current setup.</h1>
            )}
            {top ? (
              <div className="verdict">
                <p className="meta">Closest match</p>
                <p className="verdict__row">
                  <span className="display display--s">{top.locality.name}</span>
                  <span className="numeral verdict__num">{displayOverall(top.overall)}</span>
                </p>
                <p className="body-soft">{verdictLine(top.rows)}</p>
              </div>
            ) : (
              <p className="body-soft">Nothing residential to compare against in {city.name} yet.</p>
            )}

            <hr className="rule rule--strong" />
            <ol className="ranking">
              {match.results.map((r, i) => (
                <li
                  key={r.locality.id}
                  className={`ranking__item${hoverId === r.locality.id ? ' is-hover' : ''}`}
                  onMouseEnter={() => setHoverId(r.locality.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <span className="ranking__n numeral">{i + 1}</span>
                  <div className="ranking__body">
                    <button type="button" className="ranking__name display display--s" onClick={() => nav(`/match/${r.locality.id}`)}>
                      {r.locality.name}
                      {r.locality.subRegion ? <span className="meta ranking__sub"> {r.locality.subRegion}</span> : null}
                    </button>
                    <p className="display display--i ranking__char">{r.locality.character ?? r.locality.subRegion ?? ''}</p>
                    <RoutineThread nodes={buildThread(derived.routine, r.locality.center, baseline.anchor, r.points)} size="s" />
                    <p className="meta ranking__meta">
                      {isEquivalent(r.rows, r.overall) ? 'Equivalent to your setup' : 'Closest available'} · {r.airportMinutes ?? '–'} min to airport
                      {r.anchorMinutes != null ? ` · ${r.anchorMinutes} min to work` : ''}
                    </p>
                  </div>
                  <span className="ranking__score numeral">{displayOverall(r.overall)}</span>
                </li>
              ))}
            </ol>
            {match.results.length >= 2 ? (
              <button
                type="button"
                className="action action--quiet match__compare"
                onClick={() => dispatch({ type: 'setCompare', compare: [match.results[0]!.locality.id, match.results[1]!.locality.id] })}
              >
                Compare the top two <span aria-hidden>→</span>
              </button>
            ) : null}
          </>
        )}
      </aside>
    </section>
  );
}

function CompareColumn({ a, b, onClose }: { a: MatchResult; b: MatchResult; onClose: () => void }) {
  const { state } = useLocus();
  return (
    <>
      <p className="meta">Side by side</p>
      <h1 className="display display--m match__h">
        {a.locality.name} <span className="display--i body-soft">or</span> {b.locality.name}
      </h1>
      <div className="cmp-head">
        <span className="meta">Yours</span>
        <span className="meta meta--ink">{a.locality.name} · {displayOverall(a.overall)}</span>
        <span className="meta meta--ink">{b.locality.name} · {displayOverall(b.overall)}</span>
      </div>
      <hr className="rule rule--strong" />
      <ul className="ledger ledger--cmp">
        {CATEGORY_KEYS.filter((k) => state.importance[k] !== 'none').map((k) => {
          const ra = a.rows.find((r) => r.category === k)!;
          const rb = b.rows.find((r) => r.category === k)!;
          return (
            <li key={k} className="ledger__row ledger__row--cmp">
              <span className="ledger__glyph">
                <CategoryGlyph category={k} mode={importanceToMode(ra.importance)} size={12} color={ra.importance === 'must' ? 'var(--ballpoint)' : 'var(--ink)'} />
              </span>
              <span className="ledger__label">{CATEGORIES[k].label}</span>
              <span className="cmp-nums">
                <span className="numeral cmp-num cmp-num--yours">{ra.baseline}</span>
                <span className="numeral cmp-num">{ra.candidate}</span>
                <span className="numeral cmp-num">{rb.candidate}</span>
              </span>
              <RangeStrip score={ra.score} score2={rb.score} isMust={ra.importance === 'must'} />
            </li>
          );
        })}
      </ul>
      <hr className="rule rule--strong" />
      <p className="meta cmp-legend">
        <span className="cmp-legend__yours">▌</span> yours &nbsp; <span className="cmp-legend__a">▌</span> {a.locality.name} &nbsp; <span className="cmp-legend__b">▌</span> {b.locality.name}
      </p>
      <button type="button" className="action action--quiet" onClick={onClose}>
        ← Back to the ranking
      </button>
    </>
  );
}
