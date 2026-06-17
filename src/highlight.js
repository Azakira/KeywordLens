// highlight.js — the core matching algorithm, kept pure (no DOM).
//
// The whole-word setting and the families array are passed in as explicit
// arguments rather than read from shared globals, so the engine can be
// unit-tested in isolation.

import { familyColorClass } from './palette.js';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Split one comma-separated list into trimmed, case-insensitively de-duplicated
// keywords (first spelling wins).
export function parseKeywords(input) {
  const seen = new Set();
  return String(input)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .filter((k) => {
      const lower = k.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
}

// Flatten every family's keywords into a single, globally de-duplicated list of
// entries carrying the family metadata each match needs. A keyword is attributed
// to the first family that declares it.
export function getAllKeywordEntries(families) {
  const globalSeen = new Set();
  const entries = [];

  families.forEach((family) => {
    parseKeywords(family.keywords).forEach((keyword) => {
      const lower = keyword.toLowerCase();
      if (globalSeen.has(lower)) return;
      globalSeen.add(lower);
      entries.push({
        keyword,
        familyId: family.id,
        familyName: family.name,
        colorIndex: family.colorIndex,
      });
    });
  });

  return entries;
}

// Regex for one keyword. Whole-word mode wraps it in non-word-character
// lookaround so matches stand alone rather than nesting inside longer words.
export function buildRegex(keyword, { wholeWord = false, global = true } = {}) {
  const escaped = escapeRegex(keyword);
  const flags = global ? 'gi' : 'i';

  if (!wholeWord) {
    return new RegExp(escaped, flags);
  }

  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, flags);
}

function findEntryForMatch(matchText, entriesByLower) {
  return entriesByLower.get(matchText.toLowerCase());
}

// Produce the highlight-overlay HTML: keyword matches wrapped in family-colored
// <mark> spans, all other text HTML-escaped. Longer keywords are tried first so
// a phrase wins over a substring of it.
export function highlightText(text, keywordEntries, { wholeWord = false } = {}) {
  if (!text) return '';
  if (!keywordEntries.length) return escapeHtml(text);

  const sorted = [...keywordEntries].sort((a, b) => b.keyword.length - a.keyword.length);
  const pattern = sorted.map((entry) => escapeRegex(entry.keyword)).join('|');
  const boundaryStart = wholeWord ? '(?<![A-Za-z0-9_])' : '';
  const boundaryEnd = wholeWord ? '(?![A-Za-z0-9_])' : '';
  const regex = new RegExp(`${boundaryStart}(${pattern})${boundaryEnd}`, 'gi');
  const entriesByLower = new Map(sorted.map((entry) => [entry.keyword.toLowerCase(), entry]));

  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const entry = findEntryForMatch(match[0], entriesByLower);
    const familyTitle = entry ? `${entry.familyName}: ${match[0]}` : match[0];
    const familyClass = entry ? familyColorClass(entry.colorIndex) : 'family-0';

    result += escapeHtml(text.slice(lastIndex, match.index));
    result += `<mark class="${familyClass}" title="${escapeHtml(familyTitle)}">${escapeHtml(match[0])}</mark>`;
    lastIndex = regex.lastIndex;

    if (match.index === regex.lastIndex) regex.lastIndex++;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}
