// stats.js — occurrence counting and the rows-by-family model behind the
// occurrences panel. Pure (no DOM); whole-word mode is an explicit argument.

import { parseKeywords, buildRegex } from './highlight.js';

// How many times a keyword appears in the text.
export function countOccurrences(text, keyword, { wholeWord = false } = {}) {
  if (!text || !keyword) return 0;
  const matches = text.match(buildRegex(keyword, { wholeWord, global: true }));
  return matches ? matches.length : 0;
}

// For each non-empty family, the per-keyword counts, sorted most-present first
// (ties broken alphabetically). Families with no keywords are dropped.
//
// `text` may be a single string (scope: active resume) or an array of strings
// (scope: all resume tabs), in which case counts are summed across every text.
export function computeRowsByFamily(text, families, { wholeWord = false } = {}) {
  const texts = Array.isArray(text) ? text : [text];
  const countAcross = (keyword) =>
    texts.reduce((sum, single) => sum + countOccurrences(single, keyword, { wholeWord }), 0);

  return families
    .map((family) => {
      const rows = parseKeywords(family.keywords)
        .map((keyword) => ({
          keyword,
          count: countAcross(keyword),
        }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.keyword.localeCompare(b.keyword);
        });

      return {
        familyId: family.id,
        familyName: family.name,
        colorIndex: family.colorIndex,
        rows,
      };
    })
    .filter((group) => group.rows.length > 0);
}
