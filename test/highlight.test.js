import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  escapeRegex,
  parseKeywords,
  getAllKeywordEntries,
  buildRegex,
  highlightText,
} from '../src/highlight.js';

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml(`<a href="x" data='y'>&`)).toBe(
      '&lt;a href=&quot;x&quot; data=&#039;y&#039;&gt;&amp;'
    );
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('escapeRegex', () => {
  it('escapes regex metacharacters so keywords match literally', () => {
    expect(escapeRegex('a.b*c+(d)')).toBe('a\\.b\\*c\\+\\(d\\)');
  });
});

describe('parseKeywords', () => {
  it('splits on commas, trims, and drops empties', () => {
    expect(parseKeywords(' SQL , Python ,, ')).toEqual(['SQL', 'Python']);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    expect(parseKeywords('SQL, sql, Sql')).toEqual(['SQL']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseKeywords('   ')).toEqual([]);
  });
});

describe('getAllKeywordEntries', () => {
  const families = [
    { id: 1, name: 'Tech', colorIndex: 0, keywords: 'SQL, Python' },
    { id: 2, name: 'Tools', colorIndex: 1, keywords: 'python, Docker' },
  ];

  it('collects entries across families with family metadata', () => {
    const entries = getAllKeywordEntries(families);
    expect(entries).toEqual([
      { keyword: 'SQL', familyId: 1, familyName: 'Tech', colorIndex: 0 },
      { keyword: 'Python', familyId: 1, familyName: 'Tech', colorIndex: 0 },
      { keyword: 'Docker', familyId: 2, familyName: 'Tools', colorIndex: 1 },
    ]);
  });

  it('dedupes a keyword globally, attributing it to the first family that declares it', () => {
    const entries = getAllKeywordEntries(families);
    const pythons = entries.filter((e) => e.keyword.toLowerCase() === 'python');
    expect(pythons).toHaveLength(1);
    expect(pythons[0].familyId).toBe(1);
  });
});

describe('buildRegex', () => {
  it('matches substrings when wholeWord is off', () => {
    const re = buildRegex('cat', { wholeWord: false });
    expect('concatenate'.match(re)).not.toBeNull();
  });

  it('requires word boundaries when wholeWord is on', () => {
    const re = buildRegex('cat', { wholeWord: true });
    expect('concatenate'.match(re)).toBeNull();
    expect('a cat sat'.match(re)).not.toBeNull();
  });

  it('escapes the keyword so metacharacters are literal', () => {
    const re = buildRegex('c++', { wholeWord: false });
    expect('I know c++ well'.match(re)).not.toBeNull();
    expect('cccc'.match(re)).toBeNull();
  });
});

describe('highlightText', () => {
  const entries = [
    { keyword: 'SQL', familyId: 1, familyName: 'Tech', colorIndex: 0 },
    { keyword: 'Python', familyId: 1, familyName: 'Tech', colorIndex: 2 },
  ];

  it('returns empty string for empty text', () => {
    expect(highlightText('', entries)).toBe('');
  });

  it('escapes text that contains no keywords', () => {
    expect(highlightText('a < b & c', [])).toBe('a &lt; b &amp; c');
  });

  it('wraps matches in a family-colored mark with a title', () => {
    const html = highlightText('I use SQL daily', entries);
    expect(html).toBe(
      'I use <mark class="family-0" title="Tech: SQL">SQL</mark> daily'
    );
  });

  it('matches case-insensitively but preserves the matched casing', () => {
    const html = highlightText('we love python', entries);
    expect(html).toContain('<mark class="family-2" title="Tech: python">python</mark>');
  });

  it('prefers the longer keyword when one is a substring of another', () => {
    const overlap = [
      { keyword: 'data', familyId: 1, familyName: 'A', colorIndex: 0 },
      { keyword: 'data analysis', familyId: 2, familyName: 'B', colorIndex: 1 },
    ];
    const html = highlightText('strong data analysis skills', overlap);
    expect(html).toContain('<mark class="family-1" title="B: data analysis">data analysis</mark>');
    expect(html).not.toContain('title="A: data"');
  });

  it('escapes HTML inside both surrounding text and the matched keyword', () => {
    const html = highlightText('<x> SQL', entries);
    expect(html.startsWith('&lt;x&gt; ')).toBe(true);
  });

  it('respects whole-word mode', () => {
    const subEntries = [{ keyword: 'cat', familyId: 1, familyName: 'A', colorIndex: 0 }];
    expect(highlightText('concatenate', subEntries, { wholeWord: true })).toBe('concatenate');
    expect(highlightText('concatenate', subEntries, { wholeWord: false })).toContain('<mark');
  });
});
