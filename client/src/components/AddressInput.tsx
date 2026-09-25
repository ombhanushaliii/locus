import { useEffect, useId, useMemo, useState } from 'react';
import type { DataIndex } from '@locus/shared';
import { loadIndex } from '../data';
import { searchPlaces, type Hit } from '../lib/search';
import type { HomePick } from '../state';

interface Props {
  value: HomePick | null;
  onChange: (v: HomePick | null) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  /** Rank this city's places first. */
  preferCityId?: string;
}

export function AddressInput({ value, onChange, placeholder, label, autoFocus, preferCityId }: Props) {
  const [text, setText] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<DataIndex | null>(null);
  const listId = useId();

  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setIndex(null));
  }, []);

  const hits = useMemo<Hit[]>(() => (index && open ? searchPlaces(index.search, text, 7, preferCityId) : []), [index, open, text, preferCityId]);
  const cityName = (id: string) => index?.cities.find((c) => c.id === id)?.name ?? id;

  function pick(h: Hit) {
    const e = h.entry;
    onChange({ lat: e.lat, lng: e.lng, label: e.name, cityId: e.city, cityName: cityName(e.city) });
    setText(e.name);
    setOpen(false);
  }

  return (
    <div className="address">
      <label className="meta address__label">{label}</label>
      <input
        className="ruled"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          if (value) onChange(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || hits.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % hits.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + hits.length) % hits.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const h = hits[active];
            if (h) pick(h);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && hits.length > 0 ? (
        <ul id={listId} role="listbox" className="address__list">
          {hits.map((h, i) => (
            <li
              key={`${h.entry.city}-${h.entry.k}-${h.entry.id ?? 'c'}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(h)}
            >
              <span className="address__primary">{h.entry.name}</span>
              <span className="address__secondary meta">{h.entry.k === 'c' ? 'City' : cityName(h.entry.city)}</span>
            </li>
          ))}
        </ul>
      ) : open && text.trim().length >= 2 && index ? (
        <ul id={listId} role="listbox" className="address__list">
          <li className="address__empty body-soft">No locality by that name in the cities covered yet.</li>
        </ul>
      ) : null}
    </div>
  );
}
