import { describe, it, expect } from 'vitest';
import { countOccurrences, computeRowsByFamily } from '../src/stats.js';

describe('countOccurrences', () => {
  it('counts case-insensitive occurrences', () => {
    expect(countOccurrences('SQL sql Sql', 'sql')).toBe(3);
  });

  it('returns 0 for empty text or empty keyword', () => {
    expect(countOccurrences('', 'sql')).toBe(0);
    expect(countOccurrences('sql', '')).toBe(0);
  });

  it('counts substrings when wholeWord is off', () => {
    expect(countOccurrences('cat concatenate cat', 'cat', { wholeWord: false })).toBe(3);
  });

  it('counts only standalone words when wholeWord is on', () => {
    expect(countOccurrences('cat concatenate cat', 'cat', { wholeWord: true })).toBe(2);
  });

  it('treats regex metacharacters in the keyword literally', () => {
    expect(countOccurrences('c++ and c++', 'c++')).toBe(2);
  });
});

describe('computeRowsByFamily', () => {
  const families = [
    { id: 1, name: 'Tech', colorIndex: 0, keywords: 'SQL, Python, Rust' },
    { id: 2, name: 'Empty', colorIndex: 1, keywords: '' },
  ];

  it('drops families that have no keywords', () => {
    const groups = computeRowsByFamily('SQL Python', families);
    expect(groups.map((g) => g.familyId)).toEqual([1]);
  });

  it('returns each kept group with its family metadata', () => {
    const [group] = computeRowsByFamily('SQL Python', families);
    expect(group).toMatchObject({ familyId: 1, familyName: 'Tech', colorIndex: 0 });
    expect(group.rows.map((r) => r.keyword).sort()).toEqual(['Python', 'Rust', 'SQL']);
  });

  it('counts occurrences per keyword', () => {
    const [group] = computeRowsByFamily('SQL SQL Python', families);
    const counts = Object.fromEntries(group.rows.map((r) => [r.keyword, r.count]));
    expect(counts).toEqual({ SQL: 2, Python: 1, Rust: 0 });
  });

  it('sorts rows by count descending, then keyword alphabetically', () => {
    const [group] = computeRowsByFamily('Python Python SQL', families);
    expect(group.rows.map((r) => r.keyword)).toEqual(['Python', 'SQL', 'Rust']);
  });

  it('honors whole-word counting', () => {
    const fams = [{ id: 1, name: 'A', colorIndex: 0, keywords: 'cat' }];
    const [whole] = computeRowsByFamily('cat concatenate', fams, { wholeWord: true });
    const [sub] = computeRowsByFamily('cat concatenate', fams, { wholeWord: false });
    expect(whole.rows[0].count).toBe(1);
    expect(sub.rows[0].count).toBe(2);
  });

  it('aggregates counts across multiple texts (scope: all)', () => {
    const fams = [{ id: 1, name: 'Tech', colorIndex: 0, keywords: 'SQL, Rust' }];
    const [group] = computeRowsByFamily(['SQL here', 'SQL and SQL there'], fams);
    const counts = Object.fromEntries(group.rows.map((r) => [r.keyword, r.count]));
    expect(counts).toEqual({ SQL: 3, Rust: 0 });
  });

  it('treats a single string the same as a one-element array', () => {
    const fams = [{ id: 1, name: 'A', colorIndex: 0, keywords: 'SQL' }];
    const [fromString] = computeRowsByFamily('SQL SQL', fams);
    const [fromArray] = computeRowsByFamily(['SQL SQL'], fams);
    expect(fromString.rows[0].count).toBe(fromArray.rows[0].count);
  });
});
