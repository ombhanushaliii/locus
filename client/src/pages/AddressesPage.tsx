import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CATEGORIES, type CityInfo } from '@locus/shared';
import { MOCK, fetchBaseline, fetchMatch, getCities } from '../api';
import { AddressInput } from '../components/AddressInput';
import { useLocus } from '../state';

export function AddressesPage() {
  const { state, dispatch } = useLocus();
  const nav = useNavigate();
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [showAnchor, setShowAnchor] = useState(state.anchor != null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCities().then(setCities).catch(() => setError('Cities did not load. Refresh to try again.'));
  }, []);

  /* ?demo=setup|match jumps straight into the Bandra West → Pune script. */
  const demo = new URLSearchParams(useLocation().search).get('demo');
  useEffect(() => {
    if (!demo || !MOCK || cities.length === 0 || state.baseline) return;
    const pune = cities.find((c) => c.id === 'pune');
    if (!pune) return;
    (async () => {
      const baseline = await fetchBaseline({ placeId: 'mock-bandra', anchorPlaceId: demo === 'anchor' ? 'mock-hinjewadi' : undefined });
      dispatch({ type: 'setHome', home: { placeId: 'mock-bandra', label: 'Bandra West' } });
      if (demo === 'anchor') dispatch({ type: 'setAnchor', anchor: { placeId: 'mock-hinjewadi', label: 'Hinjewadi Phase 1' } });
      dispatch({ type: 'setCity', city: pune });
      dispatch({ type: 'setBaseline', baseline });
      if (demo === 'locality') {
        const match = await fetchMatch({
          home: baseline.home,
          anchor: baseline.anchor,
          cityId: pune.id,
          categories: baseline.baseline.map((b) => ({ category: b.category, baselineCount: b.count, importance: CATEGORIES[b.category].defaultImportance })),
        });
        dispatch({ type: 'setMatch', match });
        nav(`/match/${match.results[0]?.locality.id ?? ''}`);
        return;
      }
      nav(demo === 'setup' ? '/setup' : '/match');
    })();
  }, [demo, cities, state.baseline, dispatch, nav]);

  const ready = state.home != null && state.city != null && !busy;

  async function go() {
    if (!state.home || !state.city) return;
    setBusy(true);
    setError(null);
    try {
      const baseline = await fetchBaseline({ placeId: state.home.placeId, anchorPlaceId: state.anchor?.placeId });
      dispatch({ type: 'setBaseline', baseline });
      nav('/setup');
    } catch {
      setError('Maps did not answer. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="addresses graticule">
      <div className="addresses__inner">
        <h1 className="display display--l addresses__q">Where do you live now?</h1>
        <AddressInput
          label="Your current home"
          placeholder="Street, building, or area"
          value={state.home}
          onChange={(home) => dispatch({ type: 'setHome', home })}
          autoFocus
        />

        <h2 className="display display--l addresses__q addresses__q--second">Where are you going?</h2>
        <div className="cities" role="radiogroup" aria-label="Destination city">
          {cities.map((c) => {
            const on = state.city?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`cities__item display${on ? ' is-on' : ''}`}
                onClick={() => dispatch({ type: 'setCity', city: c })}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="addresses__anchor">
          {showAnchor ? (
            <AddressInput
              label="Where you work or study (optional)"
              placeholder="Office, campus, or area"
              value={state.anchor}
              onChange={(anchor) => dispatch({ type: 'setAnchor', anchor })}
            />
          ) : (
            <button type="button" className="action action--quiet" onClick={() => setShowAnchor(true)}>
              + Add where you work or study
            </button>
          )}
        </div>

        <div className="addresses__go">
          {error ? <p className="addresses__error">{error}</p> : null}
          <button type="button" className="action addresses__cta" disabled={!ready} onClick={go}>
            {busy ? 'Looking around your home…' : 'See how your life translates'} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
