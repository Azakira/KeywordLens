// palette.js — curated highlight-color set, kept DOM-free so it is unit-testable.
//
// A family stores a numeric `colorIndex`; these helpers map and normalize it to
// one of the six fixed `.family-0..5` CSS classes. The color values themselves
// live in styles.css and are read by the render layer.

export const COLOR_CLASS_COUNT = 6;

// Coerce any stored/imported value into a valid palette slot [0, COLOR_CLASS_COUNT).
export function normalizeColorIndex(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((Math.trunc(n) % COLOR_CLASS_COUNT) + COLOR_CLASS_COUNT) % COLOR_CLASS_COUNT;
}

// The CSS class that paints a family's highlight color.
export function familyColorClass(colorIndex) {
  return `family-${normalizeColorIndex(colorIndex)}`;
}

// Color slot to assign a newly added family, given how many already exist.
export function nextColorIndex(familyCount) {
  return normalizeColorIndex(familyCount);
}
