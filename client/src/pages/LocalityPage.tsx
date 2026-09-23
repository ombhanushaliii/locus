import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CATEGORIES, EQUIV_MUST_MIN, displayOverall, explainRows, isEquivalent, verdictLine } from '@locus/shared';
import { CategoryGlyph, importanceToMode } from '../atlas/glyphs';
import { AtlasMap } from '../components/AtlasMap';
import { RangeStrip } from '../components/RangeStrip';
import { RoutineThread } from '../components/RoutineThread';
import { buildThread } from '../lib/geo';
import { useLocus } from '../state';

export function LocalityPage() {
  const { localityId } = useParams();
  const { state, derived } = useLocus();
  const match = state.match;
  const baseline = state.baseline;
  const r = match?.results.find((x) => String(x.locality.id) === localityId);

  const thread = useMemo(() => (r && baseline ? buildThread(derived.routine, r.locality.center, baseline.anchor, r.points) : []), [r, baseline, derived.routine]);

  if (!match || !baseline || !state.city) return <Navigate to="/match" replace />;
  if (!r) return <Navigate to="/match" replace />;

  const ex = explainRows(r.rows);
  const character = r.locality.character ?? r.locality.subRegion ?? `${r.locality.name}.`;
  const equivalent = isEquivalent(r.rows, r.overall);
  const preserved = thread.filter((n) => n.point).length;
  const kept = r.rows.filter((x) => x.importance !== 'none');

  const eyebrow = [
    state.city.name.toUpperCase(),
    r.locality.subRegion?.toUpperCase(),
    r.airportMinutes != null ? `${r.airportMinutes} MIN TO AIRPORT` : null,
    r.anchorMinutes != null ? `${r.anchorMinutes} MIN TO YOUR WORK` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="profile">
      <header className="profile__head">
        <p className="meta">{eyebrow}</p>
        <h1 className="display display--xl profile__name">{r.locality.name}</h1>
        <p className="display display--m display--i profile__char">{character}</p>
      </header>

      <div className="profile__hero">
        <div className="profile__map">
          <AtlasMap
            center={r.locality.center}
            spanM={1900}
            places={r.points.map((p, i) => ({ id: `${r.locality.id}-${i}`, lat: p.lat, lng: p.lng, category: p.category, mode: importanceToMode(state.importance[p.category]) }))}
            thread={thread}
          />
        </div>
        <div className="profile__score">
          <p className="numeral profile__num">{displayOverall(r.overall)}</p>
          <p className="meta">Lifestyle match</p>
          <p className="profile__verdict">{equivalent ? 'Equivalent to your current setup.' : match.results[0]?.locality.id === r.locality.id ? 'Closest match to your current routine.' : 'A close alternative, not an equivalent.'}</p>
          <p className="body-soft">{verdictLine(r.rows)}</p>
          <p className="meta profile__routineLabel">Your routine here · {preserved} of {thread.length} stops found</p>
          <RoutineThread nodes={thread} />
        </div>
      </div>

      <section className="profile__ledger">
        <div className="ledger-head">
          <span className="meta">Ledger</span>
          <span className="meta ledger-head__yours">Yours</span>
          <span className="meta ledger-head__here">Here</span>
          <span />
        </div>
        <hr className="rule rule--strong" />
        <ul className="ledger ledger--profile">
          {kept.map((row) => {
            const failing = row.importance === 'must' && row.score * 100 < EQUIV_MUST_MIN;
            return (
              <li key={row.category} className={`ledger__row ledger__row--profile${failing ? ' is-failing' : ''}`}>
                <span className="ledger__glyph">
                  <CategoryGlyph category={row.category} mode={importanceToMode(row.importance)} size={12} color={row.importance === 'must' ? 'var(--ballpoint)' : 'var(--ink)'} />
                </span>
                <span className="ledger__label">
                  {CATEGORIES[row.category].label}
                  <span className="meta ledger__imp-tag"> {row.importance === 'must' ? 'must-have' : 'nice-to-have'}</span>
                </span>
                <span className="numeral ledger__yours">{row.baseline}</span>
                <span className="numeral ledger__here">{row.candidate}</span>
                <RangeStrip score={row.score} isMust={row.importance === 'must'} />
                <span className="ledger__pct meta meta--ink">
                  {Math.round(Math.min(row.score, 1.2) * 100)}
                  {failing ? <span className="meta meta--accent"> · below {EQUIV_MUST_MIN}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <hr className="rule rule--strong" />
      </section>

      <section className="profile__cols">
        <Column title="What you’d keep" lines={ex.keep} empty="Little of your current reach carries over unchanged." />
        <Column title="What would change" lines={ex.change} empty="No partial changes; things either hold or drop." />
        <Column title="What you’d give up" lines={ex.giveUp} empty="Nothing you rely on drops below your current level." />
        <Column title="What you’d gain" lines={ex.gain} empty="Nothing here exceeds what you have now." />
      </section>

      <footer className="profile__foot">
        <Link to="/match" className="action action--quiet">
          ← Back to the match
        </Link>
      </footer>
    </article>
  );
}

function Column({ title, lines, empty }: { title: string; lines: string[]; empty: string }) {
  return (
    <div className="col">
      <p className="meta col__title">{title}</p>
      {lines.length ? (
        <ul className="col__list">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="body-soft col__empty">{empty}</p>
      )}
    </div>
  );
}
