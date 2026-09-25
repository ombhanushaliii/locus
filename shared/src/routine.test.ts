import { describe, expect, it } from 'vitest';
import { deriveRoutine, ROUTINE_MAX_STOPS, routineLabel } from './routine.js';

describe('deriveRoutine', () => {
  it('chains must-haves in day order between two homes', () => {
    const r = deriveRoutine(
      [
        { category: 'restaurant', importance: 'must' },
        { category: 'rail', importance: 'must' },
        { category: 'gym', importance: 'must' },
        { category: 'grocery', importance: 'nice' },
      ],
      false,
    );
    expect(r).toEqual(['home', 'rail', 'gym', 'restaurant', 'home']);
  });
  it('inserts the anchor after transit when present', () => {
    const r = deriveRoutine([{ category: 'rail', importance: 'must' }], true);
    expect(r).toEqual(['home', 'rail', 'anchor', 'home']);
  });
  it('is just home to home with no must-haves and no anchor', () => {
    expect(deriveRoutine([], false)).toEqual(['home', 'home']);
  });
  it('caps the number of stops', () => {
    const all = ['bus', 'rail', 'cafe', 'grocery', 'pharmacy', 'gym', 'park', 'restaurant', 'salon'] as const;
    const r = deriveRoutine(
      all.map((c) => ({ category: c, importance: 'must' as const })),
      false,
    );
    expect(r.length).toBe(ROUTINE_MAX_STOPS + 2);
  });
  it('labels stops with the short category name', () => {
    expect(routineLabel('home')).toBe('HOME');
    expect(routineLabel('rail')).toBe('METRO/RAIL');
  });
});
