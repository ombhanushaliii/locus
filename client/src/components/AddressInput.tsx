import { useEffect, useId, useRef, useState } from 'react';
import type { Suggestion } from '@locus/shared';
import { suggestAddresses } from '../api';
import type { HomeInput } from '../state';

interface Props {
  value: HomeInput | null;
  onChange: (v: HomeInput | null) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}

export function AddressInput({ value, onChange, placeholder, label, autoFocus }: Props) {
  const [text, setText] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        setItems(await suggestAddresses(text));
        setActive(0);
      } catch {
        setItems([]);
      }
    }, 120);
    return () => window.clearTimeout(timer.current);
  }, [text, open]);

  function pick(s: Suggestion) {
    onChange({ placeId: s.placeId, label: s.label });
    setText(s.label);
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
          if (value) onChange(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + items.length) % items.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const s = items[active];
            if (s) pick(s);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && items.length > 0 ? (
        <ul id={listId} role="listbox" className="address__list">
          {items.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              <span className="address__primary">{s.label}</span>
              <span className="address__secondary meta">{s.secondary}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
