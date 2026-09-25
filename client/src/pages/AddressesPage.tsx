import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { scanHome, type CityIndexEntry, type CityInfo } from '@locus/shared';
import { loadCity, loadIndex, prefetchCity } from '../data';
import { searchPlaces } from '../lib/search';
import { AddressInput } from '../components/AddressInput';
import { useLocus, type HomePick } from '../state';

export function AddressesPage() {
  const { state, dispatch } = useLocus();
  const nav = useNavigate();
  const [cities, setCities] = useState<CityIndexEntry[]>([]);
  const [showAnchor, setShowAnchor] = useState(state.anchor != null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIndex()
      .then((i) => setCities(i.cities))
      .catch(() => setError('The city data did not load. Refresh to try again.'));
  }, []);

  async function buildBaseline(home: HomePick, anchor: HomePick | null) {
    const data = await loadCity(home.cityId);
    return scanHome({ lat: home.lat, lng: home.lng, label: home.label, localityLabel: home.label, cityId: home.cityId }, data.pois, anchor ? { lat: anchor.lat, lng: anchor.lng, label: anchor.label } : undefined);
  }

  /* ?demo=setup|match|locality jumps straight into Bandra West → Pune. */
  const demo = new URLSearchParams(useLocation().search).get('demo');
  useEffect(() => {
    if (!demo || cities.length === 0 || state.baseline) return;
    (async () => {
      const idx = await loadIndex();
      const hit = searchPlaces(idx.search, 'Bandra West', 1)[0];
      const pune = idx.cities.find((c) => c.id === 'pune');
      if (!hit || !pune) return;
      const home: HomePick = { lat: hit.entry.lat, lng: hit.entry.lng, label: hit.entry.name, cityId: hit.entry.city, cityName: 'Mumbai' };
      const anchor: HomePick | null = demo === 'anchor' ? (searchPlaces(idx.search, 'Hinjawadi', 1, 'pune')[0] ? { ...searchPlaces(idx.search, 'Hinjawadi', 1, 'pune')[0]!.entry, label: 'Hinjawadi', cityId: 'pune', cityName: 'Pune' } : null) : null;
      dispatch({ type: 'setHome', home });
      if (anchor) dispatch({ type: 'setAnchor', anchor });
      dispatch({ type: 'setCity', city: { id: pune.id, name: pune.name, state: pune.state } });
      dispatch({ type: 'setBaseline', baseline: await buildBaseline(home, anchor) });
      nav(demo === 'setup' ? '/setup' : demo === 'locality' ? '/match?open=1' : '/match');
    })().catch(() => setError('The demo data did not load.'));
  }, [demo, cities, state.baseline, dispatch, nav]);

  const ready = state.home != null && state.city != null && !busy;

  async function go() {
    if (!state.home || !state.city) return;
    setBusy(true);
    setError(null);
    try {
      prefetchCity(state.city.id);
      dispatch({ type: 'setBaseline', baseline: await buildBaseline(state.home, state.anchor) });
      nav('/setup');
    } catch {
      setError('That area’s data did not load. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="addresses graticule">
      <div className="addresses__inner">
        <h1 className="display display--l addresses__q">Where do you live now?</h1>
        <AddressInput label="Your current locality" placeholder="Locality or area, e.g. Kothrud" value={state.home} onChange={(home) => dispatch({ type: 'setHome', home })} autoFocus />

        <h2 className="display display--l addresses__q addresses__q--second">Where are you going?</h2>
        <div className={`cities${cities.length > 8 ? ' cities--many' : ''}`} role="radiogroup" aria-label="Destination city">
          {cities.map((c) => {
            const on = state.city?.id === c.id;
            const info: CityInfo = { id: c.id, name: c.name, state: c.state };
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`cities__item display${on ? ' is-on' : ''}`}
                onClick={() => {
                  dispatch({ type: 'setCity', city: info });
                  prefetchCity(c.id);
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        {cities.length ? <p className="meta addresses__coverage">{cities.length} cities covered · built from OpenStreetMap and Overture Maps</p> : null}

        <div className="addresses__anchor">
          {showAnchor ? (
            <AddressInput
              label="Where you’ll work or study there (optional)"
              placeholder="Locality in the new city"
              value={state.anchor}
              onChange={(anchor) => dispatch({ type: 'setAnchor', anchor })}
              preferCityId={state.city?.id}
            />
          ) : (
            <button type="button" className="action action--quiet" onClick={() => setShowAnchor(true)}>
              + Add where you’ll work or study
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
