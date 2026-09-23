import { describe, expect, it } from 'vitest';
import { explainRows } from './explain.js';
import { buildRows } from './scoring.js';

describe('explainRows', () => {
  it('sorts rows into keep / change / give up / gain by score band', () => {
    const rows = buildRows(
      [
        { category: 'grocery', baselineCount: 6, importance: 'must' },
        { category: 'fitness', baselineCount: 2, importance: 'must' },
        { category: 'healthcare', baselineCount: 10, importance: 'nice' },
        { category: 'food', baselineCount: 10, importance: 'nice' },
        { category: 'worship', baselineCount: 3, importance: 'none' },
      ],
      { grocery: 6, fitness: 1, healthcare: 8, food: 16, worship: 0 },
    );
    const ex = explainRows(rows);
    expect(ex.keep).toEqual(['Grocery at a similar reach (6 vs your 6).']);
    expect(ex.change).toEqual(['Fewer healthcare nearby (8 vs your 10).']);
    expect(ex.giveUp).toEqual(['Gym / fitness drops to 1 from your 2.']);
    expect(ex.gain).toEqual(['More restaurants & cafes (16 vs your 10).']);
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
      ['grocery', 'fitness', 'food', 'transit', 'education'].map((c) => ({ category: c as never, baselineCount: 10, importance: 'must' as const })),
      { grocery: 1, fitness: 1, food: 1, transit: 1, education: 1 },
    );
    expect(explainRows(rows).giveUp).toHaveLength(3);
  });
});
