import { describe, expect, it } from 'vitest';
import { deriveRoutine } from './routine.js';

describe('deriveRoutine', () => {
  it('chains must-haves in canonical order between two homes', () => {
    const r = deriveRoutine(
      [
        { category: 'food', importance: 'must' },
        { category: 'transit', importance: 'must' },
        { category: 'fitness', importance: 'must' },
        { category: 'grocery', importance: 'nice' },
      ],
      false,
    );
    expect(r).toEqual(['home', 'transit', 'fitness', 'food', 'home']);
  });
  it('inserts the anchor after transit when present', () => {
    const r = deriveRoutine([{ category: 'transit', importance: 'must' }], true);
    expect(r).toEqual(['home', 'transit', 'anchor', 'home']);
  });
  it('is just home to home with no must-haves and no anchor', () => {
    expect(deriveRoutine([], false)).toEqual(['home', 'home']);
  });
});
