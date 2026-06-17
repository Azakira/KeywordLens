import { describe, it, expect, vi } from 'vitest';
import { createState, createDefaultState } from '../src/state.js';

describe('createDefaultState', () => {
  it('starts with three families and the first active', () => {
    const s = createDefaultState();
    expect(s.families.map((f) => f.name)).toEqual(['Technical skills', 'Business skills', 'Tools']);
    expect(s.activeFamilyId).toBe(1);
    expect(s.wholeWord).toBe(true);
    expect(s.copyFamilySelection).toBe('all');
  });

  it('returns an independent copy each call', () => {
    const a = createDefaultState();
    const b = createDefaultState();
    a.families[0].keywords = 'mutated';
    expect(b.families[0].keywords).toBe('');
  });
});

describe('createState subscriptions', () => {
  it('notifies subscribers on mutation and supports unsubscribe', () => {
    const store = createState();
    const listener = vi.fn();
    const off = store.subscribe(listener);

    store.setResumeText('hello');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().resumeText).toBe('hello');

    off();
    store.setResumeText('again');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('scalar setters', () => {
  it('update their field and notify', () => {
    const store = createState();
    store.setWholeWord(false);
    store.setKeywordSearch('sql');
    store.setCopyFamilySelection('2');
    const s = store.getState();
    expect(s.wholeWord).toBe(false);
    expect(s.keywordSearch).toBe('sql');
    expect(s.copyFamilySelection).toBe('2');
  });
});

describe('active family', () => {
  it('getActiveFamily returns the active one, falling back to the first', () => {
    const store = createState();
    expect(store.getActiveFamily().id).toBe(1);
    store.setActiveFamily(3);
    expect(store.getActiveFamily().id).toBe(3);
  });

  it('edits keywords and name of the active family only', () => {
    const store = createState();
    store.setActiveFamily(2);
    store.setActiveFamilyKeywords('SQL, Python');
    store.setActiveFamilyName('Data');
    const fam = store.getState().families.find((f) => f.id === 2);
    expect(fam.keywords).toBe('SQL, Python');
    expect(fam.name).toBe('Data');
    expect(store.getState().families.find((f) => f.id === 1).keywords).toBe('');
  });
});

describe('addFamily', () => {
  it('appends a uniquely-id\'d family, names it by position, and activates it', () => {
    const store = createState();
    const newId = store.addFamily();
    const s = store.getState();
    expect(s.families).toHaveLength(4);
    expect(newId).toBe(4);
    expect(s.activeFamilyId).toBe(4);
    expect(s.families[3]).toMatchObject({ id: 4, name: 'Family 4', colorIndex: 3, keywords: '' });
  });
});

describe('deleteActiveFamily', () => {
  it('removes the active family and selects the previous neighbor', () => {
    const store = createState();
    store.setActiveFamily(2);
    const removed = store.deleteActiveFamily();
    expect(removed).toBe(true);
    const s = store.getState();
    expect(s.families.map((f) => f.id)).toEqual([1, 3]);
    expect(s.activeFamilyId).toBe(1);
  });

  it('refuses to delete the last remaining family', () => {
    const store = createState(createDefaultState());
    store.deleteActiveFamily();
    store.deleteActiveFamily();
    const listener = vi.fn();
    store.subscribe(listener);
    const removed = store.deleteActiveFamily();
    expect(removed).toBe(false);
    expect(store.getState().families).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('replaceSession', () => {
  it('applies provided fields and notifies once', () => {
    const store = createState();
    const listener = vi.fn();
    store.subscribe(listener);
    store.replaceSession({
      families: [{ id: 9, name: 'X', colorIndex: 0, keywords: 'a' }],
      activeFamilyId: 9,
      resumeText: 'doc',
      keywordSearch: 'a',
      copyFamilySelection: '9',
      wholeWord: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const s = store.getState();
    expect(s.families).toHaveLength(1);
    expect(s.activeFamilyId).toBe(9);
    expect(s.resumeText).toBe('doc');
    expect(s.wholeWord).toBe(false);
  });

  it('keeps the current wholeWord when the session omits it', () => {
    const store = createState();
    store.setWholeWord(false);
    store.replaceSession({
      families: [{ id: 1, name: 'A', colorIndex: 0, keywords: 'x' }],
      activeFamilyId: 1,
      resumeText: '',
      keywordSearch: '',
      copyFamilySelection: 'all',
    });
    expect(store.getState().wholeWord).toBe(false);
  });
});
