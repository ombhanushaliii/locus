import { Link, useLocation } from 'react-router-dom';
import { useLocus } from '../state';

const MOVEMENTS: { key: string; label: string; match: (p: string) => boolean }[] = [
  { key: 'addresses', label: 'Two addresses', match: (p) => p === '/' },
  { key: 'setup', label: 'Your setup', match: (p) => p.startsWith('/setup') },
  { key: 'match', label: 'The match', match: (p) => p.startsWith('/match') },
];

export function TopBar() {
  const { pathname } = useLocation();
  const { state } = useLocus();
  const pair = state.baseline && state.city ? `${state.baseline.home.localityLabel} → ${state.city.name}` : null;

  return (
    <header className="topbar">
      <Link to="/" className="topbar__mark display" aria-label="Locus, start over">
        Locus
      </Link>
      {pair ? <span className="topbar__pair meta meta--ink">{pair}</span> : <span className="topbar__pair meta">Your life, relocated</span>}
      <nav className="topbar__movements meta" aria-label="Progress">
        {MOVEMENTS.map((m, i) => (
          <span key={m.key} className={m.match(pathname) ? 'is-current' : undefined}>
            {i > 0 ? <span className="topbar__dot" aria-hidden>·</span> : null}
            {m.label}
          </span>
        ))}
      </nav>
    </header>
  );
}
