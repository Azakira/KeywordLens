import { describe, it, expect } from 'vitest';
import { COLOR_CLASS_COUNT, normalizeColorIndex, familyColorClass, nextColorIndex } from '../src/palette.js';

describe('palette', () => {
  it('exposes the curated color-class count', () => {
    expect(COLOR_CLASS_COUNT).toBe(6);
  });

  describe('normalizeColorIndex', () => {
    it('passes in-range indices through unchanged', () => {
      expect(normalizeColorIndex(0)).toBe(0);
      expect(normalizeColorIndex(5)).toBe(5);
    });

    it('wraps out-of-range indices into [0, count)', () => {
      expect(normalizeColorIndex(6)).toBe(0);
      expect(normalizeColorIndex(7)).toBe(1);
    });

    it('wraps negative indices into [0, count)', () => {
      expect(normalizeColorIndex(-1)).toBe(5);
    });

    it('falls back to 0 for non-finite values', () => {
      expect(normalizeColorIndex(NaN)).toBe(0);
      expect(normalizeColorIndex(undefined)).toBe(0);
      expect(normalizeColorIndex('not a number')).toBe(0);
    });

    it('coerces numeric strings', () => {
      expect(normalizeColorIndex('3')).toBe(3);
    });
  });

  describe('familyColorClass', () => {
    it('builds the CSS class for a normalized index', () => {
      expect(familyColorClass(2)).toBe('family-2');
      expect(familyColorClass(8)).toBe('family-2');
    });
  });

  describe('nextColorIndex', () => {
    it('assigns the next color by family count, wrapping by the palette size', () => {
      expect(nextColorIndex(0)).toBe(0);
      expect(nextColorIndex(3)).toBe(3);
      expect(nextColorIndex(6)).toBe(0);
    });
  });
});
