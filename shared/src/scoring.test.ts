import { describe, expect, it } from 'vitest';
import { buildRows, categoryScore, displayOverall, isEquivalent, isSparse, overall, verdictLine, type ScoreRow } from './scoring.js';

const row = (p: Partial<ScoreRow> & Pick<ScoreRow, 'category'>): ScoreRow => {
  const baseline = p.baseline ?? 5;
  const candidate = p.candidate ?? 5;
  return {
    category: p.category,
    baseline,
    candidate,
    importance: p.importance ?? 'must',
    score: p.score ?? categoryScore(baseline, candidate),
  };
};

describe('categoryScore', () => {
  it('is the ratio candidate/baseline', () => {
    expect(categoryScore(4, 2)).toBe(0.5);
  });
  it('caps at 1.2', () => {
    expect(categoryScore(1, 20)).toBe(1.2);
  });
  it('treats baseline 0 as 1', () => {
    expect(categoryScore(0, 0)).toBe(0);
    expect(categoryScore(0, 1)).toBe(1);
    expect(categoryScore(0, 5)).toBe(1.2);
  });
  it('saturated vs saturated reads as 1.0', () => {
    expect(categoryScore(20, 20)).toBe(1);
  });
});

describe('overall', () => {
  it('weights must 3 and nice 1', () => {
    const rows = [
      row({ category: 'grocery', importance: 'must', baseline: 10, candidate: 10 }),
      row({ category: 'restaurant', importance: 'nice', baseline: 10, candidate: 6 }),
    ];
    expect(overall(rows)).toBe(90);
  });
  it('excludes dont-care rows', () => {
    const rows = [
      row({ category: 'grocery', importance: 'must', baseline: 10, candidate: 5 }),
      row({ category: 'worship', importance: 'none', baseline: 1, candidate: 0 }),
    ];
    expect(overall(rows)).toBe(50);
  });
  it('returns 0 when everything is dont-care', () => {
    expect(overall([row({ category: 'grocery', importance: 'none' })])).toBe(0);
  });
  it('raw can exceed 100; display clamps', () => {
    const rows = [row({ category: 'grocery', baseline: 1, candidate: 20 })];
    expect(overall(rows)).toBe(120);
    expect(displayOverall(120)).toBe(100);
  });
});

describe('isEquivalent', () => {
  it('requires overall >= 85 and every must >= 70', () => {
    const rows = [
      row({ category: 'grocery', importance: 'must', baseline: 10, candidate: 9 }),
      row({ category: 'rail', importance: 'must', baseline: 2, candidate: 2 }),
    ];
    expect(isEquivalent(rows, overall(rows))).toBe(true);
  });
  it('fails when a must-have is under 70 even with high overall', () => {
    const rows = [
      row({ category: 'grocery', importance: 'must', baseline: 1, candidate: 20 }),
      row({ category: 'hospital', importance: 'must', baseline: 10, candidate: 6 }),
      row({ category: 'restaurant', importance: 'nice', baseline: 1, candidate: 20 }),
    ];
    expect(overall(rows)).toBeGreaterThanOrEqual(85);
    expect(isEquivalent(rows, overall(rows))).toBe(false);
  });
  it('ignores nice-to-have rows for the must threshold', () => {
    const rows = [
      row({ category: 'grocery', importance: 'must', baseline: 5, candidate: 5 }),
      row({ category: 'restaurant', importance: 'nice', baseline: 10, candidate: 3 }),
    ];
    expect(isEquivalent(rows, overall(rows))).toBe(false);
  });
});

describe('isSparse', () => {
  it('flags totals under 5', () => {
    expect(isSparse([{ count: 2 }, { count: 2 }])).toBe(true);
    expect(isSparse([{ count: 3 }, { count: 2 }])).toBe(false);
  });
});

describe('buildRows + verdictLine', () => {
  it('builds rows from baseline and candidate counts', () => {
    const rows = buildRows(
      [
        { category: 'grocery', baselineCount: 6, importance: 'must' },
        { category: 'gym', baselineCount: 2, importance: 'must' },
        { category: 'restaurant', baselineCount: 14, importance: 'nice' },
      ],
      { grocery: 6, gym: 1, restaurant: 16 },
    );
    expect(rows.map((r) => r.candidate)).toEqual([6, 1, 16]);
    expect(verdictLine(rows)).toBe('Strong on restaurants and daily groceries. Weaker on gyms.');
  });
  it('uses the Oxford comma for three or more', () => {
    const rows = buildRows(
      [
        { category: 'grocery', baselineCount: 1, importance: 'must' },
        { category: 'rail', baselineCount: 1, importance: 'must' },
        { category: 'restaurant', baselineCount: 1, importance: 'must' },
      ],
      { grocery: 2, rail: 2, restaurant: 2 },
    );
    expect(verdictLine(rows)).toBe('Strong on daily groceries, metro & rail stations, and restaurants.');
  });
  it('has a neutral line when nothing is strong or weak', () => {
    const rows = buildRows([{ category: 'grocery', baselineCount: 10, importance: 'must' }], { grocery: 8 });
    expect(verdictLine(rows)).toBe('Close to your current setup across the board.');
  });
});

describe('verdictLine capping', () => {
  it('names at most three categories per clause and counts the rest', () => {
    const rows = buildRows(
      [
        { category: 'grocery', baselineCount: 1, importance: 'must' },
        { category: 'rail', baselineCount: 1, importance: 'must' },
        { category: 'restaurant', baselineCount: 1, importance: 'nice' },
        { category: 'school', baselineCount: 1, importance: 'nice' },
        { category: 'cinema', baselineCount: 1, importance: 'nice' },
      ],
      { grocery: 1, rail: 1, restaurant: 1, school: 1, cinema: 1 },
    );
    expect(verdictLine(rows)).toBe('Strong on daily groceries, metro & rail stations, restaurants, and 2 more.');
  });
});
