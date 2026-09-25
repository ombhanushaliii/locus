import { describe, expect, it } from 'vitest';
import { explainRows } from './explain.js';
import { buildRows } from './scoring.js';

describe('explainRows', () => {
  it('sorts rows into keep / change / give up / gain by score band', () => {
    const rows = buildRows(
      [
        { category: 'grocery', baselineCount: 6, importance: 'must' },
        { category: 'gym', baselineCount: 2, importance: 'must' },
        { category: 'hospital', baselineCount: 10, importance: 'nice' },
        { category: 'restaurant', baselineCount: 10, importance: 'nice' },
        { category: 'worship', baselineCount: 3, importance: 'none' },
      ],
      { grocery: 6, gym: 1, hospital: 8, restaurant: 16, worship: 0 },
    );
    const ex = explainRows(rows);
    expect(ex.keep).toEqual(['Daily groceries at a similar reach (6 vs your 6).']);
    expect(ex.change).toEqual(['Fewer hospitals nearby (8 vs your 10).']);
    expect(ex.giveUp).toEqual(['Gyms drops to 1 from your 2.']);
    expect(ex.gain).toEqual(['More restaurants (16 vs your 10).']);
    expect(ex.verdict).toBe('Most of your routine carries over; one gap to weigh.');
  });

  it('ignores dont-care rows and reports an intact routine when nothing drops', () => {
    const rows = buildRows(
      [
        { category: 'grocery', baselineCount: 5, importance: 'must' },
        { category: 'worship', baselineCount: 5, importance: 'none' },
      ],
      { grocery: 5, worship: 0 },
    );
    const ex = explainRows(rows);
    expect(ex.giveUp).toEqual([]);
    expect(ex.verdict).toBe('Your routine carries over almost intact.');
  });

  it('caps each column at three lines', () => {
    const rows = buildRows(
      (['grocery', 'gym', 'restaurant', 'rail', 'school'] as const).map((c) => ({ category: c, baselineCount: 10, importance: 'must' as const })),
      { grocery: 1, gym: 1, restaurant: 1, rail: 1, school: 1 },
    );
    expect(explainRows(rows).giveUp).toHaveLength(3);
  });
});
