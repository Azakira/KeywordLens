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

  it('starts with one empty resume tab and active scope', () => {
    const s = createDefaultState();
    expect(s.resumes).toEqual([{ id: 1, name: 'Resume 1', text: '' }]);
    expect(s.activeResumeId).toBe(1);
    expect(s.scope).toBe('active');
  });

  it('returns an independent copy each call', () => {
    const a = createDefaultState();
    const b = createDefaultState();
    a.families[0].keywords = 'mutated';
    a.resumes[0].text = 'mutated';
    expect(b.families[0].keywords).toBe('');
    expect(b.resumes[0].text).toBe('');
  });
});

describe('createState subscriptions', () => {
  it('notifies subscribers on mutation and supports unsubscribe', () => {
    const store = createState();
    const listener = vi.fn();
    const off = store.subscribe(listener);

    store.setResumeText('hello');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getActiveResume().text).toBe('hello');

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
    store.setScope('all');
    const s = store.getState();
    expect(s.wholeWord).toBe(false);
    expect(s.keywordSearch).toBe('sql');
    expect(s.copyFamilySelection).toBe('2');
    expect(s.scope).toBe('all');
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

describe('active resume', () => {
  it('getActiveResume returns the active one, falling back to the first', () => {
    const store = createState();
    expect(store.getActiveResume().id).toBe(1);
  });

  it('setResumeText writes to the active resume only', () => {
    const store = createState();
    const second = store.addResume();
    store.setResumeText('second text');
    expect(store.getState().resumes.find((r) => r.id === second).text).toBe('second text');
    expect(store.getState().resumes.find((r) => r.id === 1).text).toBe('');
  });

  it('setActiveResumeName renames the active resume only', () => {
    const store = createState();
    store.addResume();
    store.setActiveResumeName('Backend variant');
    const s = store.getState();
    expect(s.resumes.find((r) => r.id === s.activeResumeId).name).toBe('Backend variant');
    expect(s.resumes.find((r) => r.id === 1).name).toBe('Resume 1');
  });
});

describe('addResume', () => {
  it('appends a uniquely-id\'d resume, names it by position, and activates it', () => {
    const store = createState();
    const newId = store.addResume();
    const s = store.getState();
    expect(s.resumes).toHaveLength(2);
    expect(newId).toBe(2);
    expect(s.activeResumeId).toBe(2);
    expect(s.resumes[1]).toEqual({ id: 2, name: 'Resume 2', text: '' });
  });
});

describe('deleteActiveResume', () => {
  it('removes the active resume and selects the previous neighbor', () => {
    const store = createState();
    store.addResume(); // id 2, active
    store.addResume(); // id 3, active
    store.setActiveResume(2);
    const removed = store.deleteActiveResume();
    expect(removed).toBe(true);
    const s = store.getState();
    expect(s.resumes.map((r) => r.id)).toEqual([1, 3]);
    expect(s.activeResumeId).toBe(1);
  });

  it('refuses to delete the last remaining resume', () => {
    const store = createState();
    const listener = vi.fn();
    store.subscribe(listener);
    const removed = store.deleteActiveResume();
    expect(removed).toBe(false);
    expect(store.getState().resumes).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('deleteResume / renameResume by id', () => {
  it('deleteResume removes a specific tab and leaves the active tab unchanged', () => {
    const store = createState();
    store.addResume(); // id 2, active
    store.addResume(); // id 3, active
    const removed = store.deleteResume(1);
    expect(removed).toBe(true);
    const s = store.getState();
    expect(s.resumes.map((r) => r.id)).toEqual([2, 3]);
    expect(s.activeResumeId).toBe(3);
  });

  it('deleteResume on the active tab selects the previous neighbor', () => {
    const store = createState();
    store.addResume(); // id 2, active
    store.deleteResume(2);
    expect(store.getState().activeResumeId).toBe(1);
  });

  it('deleteResume refuses the last tab and ignores unknown ids', () => {
    const store = createState();
    expect(store.deleteResume(1)).toBe(false);
    store.addResume();
    expect(store.deleteResume(999)).toBe(false);
  });

  it('renameResume renames by id without changing the active tab', () => {
    const store = createState();
    store.addResume(); // id 2, active
    store.renameResume(1, 'First');
    const s = store.getState();
    expect(s.resumes.find((r) => r.id === 1).name).toBe('First');
    expect(s.activeResumeId).toBe(2);
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
      resumes: [{ id: 5, name: 'R', text: 'doc' }],
      activeResumeId: 5,
      scope: 'all',
      keywordSearch: 'a',
      copyFamilySelection: '9',
      wholeWord: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const s = store.getState();
    expect(s.families).toHaveLength(1);
    expect(s.activeFamilyId).toBe(9);
    expect(s.resumes).toEqual([{ id: 5, name: 'R', text: 'doc' }]);
    expect(s.activeResumeId).toBe(5);
    expect(s.scope).toBe('all');
    expect(s.wholeWord).toBe(false);
  });

  it('keeps the current wholeWord when the session omits it', () => {
    const store = createState();
    store.setWholeWord(false);
    store.replaceSession({
      families: [{ id: 1, name: 'A', colorIndex: 0, keywords: 'x' }],
      activeFamilyId: 1,
      resumes: [{ id: 1, name: 'Resume 1', text: '' }],
      activeResumeId: 1,
      keywordSearch: '',
      copyFamilySelection: 'all',
    });
    expect(store.getState().wholeWord).toBe(false);
  });
});
