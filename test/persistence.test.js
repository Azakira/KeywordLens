import { describe, it, expect, beforeEach } from 'vitest';
import {
  APP_ID,
  SCHEMA_VERSION,
  AUTOSAVE_KEY,
  HISTORY_KEY,
  buildSessionPayload,
  sanitizeLoadedFamilies,
  extractSession,
  saveAutosave,
  readAutosave,
  clearStoredSession,
  saveHistory,
  readHistory,
} from '../src/persistence.js';

const sampleSession = () => ({
  resumeText: 'I write SQL daily',
  activeFamilyId: 2,
  wholeWord: false,
  keywordSearch: 'sql',
  copyFamilySelection: '2',
  leftWidth: '60%',
  rightTopHeight: '40%',
  families: [
    { id: 1, name: 'Tech', colorIndex: 0, keywords: 'SQL' },
    { id: 2, name: 'Tools', colorIndex: 1, keywords: 'Docker' },
  ],
});

describe('buildSessionPayload', () => {
  it('stamps app id, schema version, source and a timestamp', () => {
    const payload = buildSessionPayload(sampleSession(), 'manual');
    expect(payload.app).toBe(APP_ID);
    expect(payload.version).toBe(SCHEMA_VERSION);
    expect(payload.source).toBe('manual');
    expect(typeof payload.savedAt).toBe('string');
  });

  it('carries the session fields through', () => {
    const payload = buildSessionPayload(sampleSession(), 'autosave');
    expect(payload.resumeText).toBe('I write SQL daily');
    expect(payload.families).toHaveLength(2);
  });
});

describe('sanitizeLoadedFamilies', () => {
  it('returns null for non-array input', () => {
    expect(sanitizeLoadedFamilies(null)).toBeNull();
    expect(sanitizeLoadedFamilies('nope')).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(sanitizeLoadedFamilies([])).toBeNull();
  });

  it('fills a default name for a nameless, keywordless entry (it is not dropped)', () => {
    expect(sanitizeLoadedFamilies([{ name: '', keywords: '' }])).toEqual([
      { id: 1, name: 'Family 1', colorIndex: 0, keywords: '' },
    ]);
  });

  it('coerces field types and fills defaults', () => {
    const cleaned = sanitizeLoadedFamilies([{ id: '5', name: 7, colorIndex: '2', keywords: 99 }]);
    expect(cleaned).toEqual([{ id: 5, name: '7', colorIndex: 2, keywords: '99' }]);
  });

  it('reassigns duplicate or invalid ids to be unique', () => {
    const cleaned = sanitizeLoadedFamilies([
      { id: 1, name: 'A', keywords: 'x' },
      { id: 1, name: 'B', keywords: 'y' },
    ]);
    expect(cleaned.map((f) => f.id)).toEqual([1, 2]);
  });

  it('normalizes color indices into the palette range', () => {
    const cleaned = sanitizeLoadedFamilies([{ id: 1, name: 'A', colorIndex: 8, keywords: 'x' }]);
    expect(cleaned[0].colorIndex).toBe(2);
  });
});

describe('extractSession', () => {
  it('round-trips a built payload back into a session', () => {
    const session = sampleSession();
    const payload = buildSessionPayload(session, 'manual');
    expect(extractSession(payload)).toEqual(session);
  });

  it('throws when there are no valid families', () => {
    expect(() => extractSession({ families: null })).toThrow();
  });

  it('falls back to the first family when activeFamilyId is unknown', () => {
    const session = extractSession({ activeFamilyId: 999, families: [{ id: 7, name: 'A', keywords: 'x' }] });
    expect(session.activeFamilyId).toBe(7);
  });

  it('omits wholeWord when the payload does not specify a boolean', () => {
    const session = extractSession({ families: [{ id: 1, name: 'A', keywords: 'x' }] });
    expect(session.wholeWord).toBeUndefined();
  });

  it('defaults copyFamilySelection to "all" and keywordSearch/resumeText to empty', () => {
    const session = extractSession({ families: [{ id: 1, name: 'A', keywords: 'x' }] });
    expect(session.copyFamilySelection).toBe('all');
    expect(session.keywordSearch).toBe('');
    expect(session.resumeText).toBe('');
  });

  it('ignores layout values that are not a percentage', () => {
    const session = extractSession({
      leftWidth: 'javascript:evil',
      rightTopHeight: '40%',
      families: [{ id: 1, name: 'A', keywords: 'x' }],
    });
    expect(session.leftWidth).toBeUndefined();
    expect(session.rightTopHeight).toBe('40%');
  });
});

describe('storage round-trips (jsdom)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('saves and reads back an autosave payload', () => {
    const payload = buildSessionPayload(sampleSession(), 'autosave');
    saveAutosave(payload);
    expect(localStorage.getItem(AUTOSAVE_KEY)).not.toBeNull();
    expect(readAutosave()).toEqual(payload);
  });

  it('returns null when no autosave is present', () => {
    expect(readAutosave()).toBeNull();
  });

  it('clears both the autosave and history keys', () => {
    saveAutosave(buildSessionPayload(sampleSession(), 'autosave'));
    saveHistory({ undoStack: ['a'], redoStack: [] });
    clearStoredSession();
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull();
    expect(sessionStorage.getItem(HISTORY_KEY)).toBeNull();
  });

  it('saves and reads back history stacks, coercing non-arrays to empty', () => {
    saveHistory({ undoStack: ['s1', 's2'], redoStack: ['s3'] });
    expect(readHistory()).toEqual({ undoStack: ['s1', 's2'], redoStack: ['s3'] });

    sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ undoStack: 'bad', redoStack: null }));
    expect(readHistory()).toEqual({ undoStack: [], redoStack: [] });
  });

  it('returns null history when none is stored', () => {
    expect(readHistory()).toBeNull();
  });
});
