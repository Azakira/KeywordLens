// state.js — the single in-memory source of truth: families, the active family,
// the resume text, and matching/filter settings, with mutators and a
// subscribe/notify channel. No DOM access; the render layer subscribes and
// repaints from getState().
//
// Layout dimensions (left width / right-top height) deliberately live as CSS
// custom properties in the render layer, not here — they are a purely visual
// concern read back at save time.

import { nextColorIndex } from './palette.js';

export function createDefaultState() {
  return {
    families: [
      { id: 1, name: 'Technical skills', colorIndex: 0, keywords: '' },
      { id: 2, name: 'Business skills', colorIndex: 1, keywords: '' },
      { id: 3, name: 'Tools', colorIndex: 2, keywords: '' },
    ],
    activeFamilyId: 1,
    resumeText: '',
    wholeWord: true,
    keywordSearch: '',
    copyFamilySelection: 'all',
  };
}

export function createState(initial = createDefaultState()) {
  const state = initial;
  const listeners = new Set();

  const notify = () => listeners.forEach((fn) => fn(state));

  function getState() {
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function getActiveFamily() {
    return state.families.find((family) => family.id === state.activeFamilyId) || state.families[0];
  }

  function setResumeText(value) {
    state.resumeText = String(value);
    notify();
  }

  function setWholeWord(value) {
    state.wholeWord = Boolean(value);
    notify();
  }

  function setKeywordSearch(value) {
    state.keywordSearch = String(value);
    notify();
  }

  function setCopyFamilySelection(value) {
    state.copyFamilySelection = String(value);
    notify();
  }

  function setActiveFamily(id) {
    state.activeFamilyId = Number(id);
    notify();
  }

  function setActiveFamilyKeywords(value) {
    getActiveFamily().keywords = String(value);
    notify();
  }

  function setActiveFamilyName(value) {
    getActiveFamily().name = String(value);
    notify();
  }

  function addFamily() {
    const nextId = Math.max(0, ...state.families.map((family) => family.id)) + 1;
    state.families.push({
      id: nextId,
      name: `Family ${state.families.length + 1}`,
      colorIndex: nextColorIndex(state.families.length),
      keywords: '',
    });
    state.activeFamilyId = nextId;
    notify();
    return nextId;
  }

  function deleteActiveFamily() {
    if (state.families.length <= 1) return false;
    const activeIndex = state.families.findIndex((family) => family.id === state.activeFamilyId);
    state.families = state.families.filter((family) => family.id !== state.activeFamilyId);
    const nextFamily = state.families[Math.max(0, activeIndex - 1)] || state.families[0];
    state.activeFamilyId = nextFamily.id;
    notify();
    return true;
  }

  // Apply a normalized session (from persistence.extractSession or a history
  // snapshot). Only provided fields are written, so e.g. an omitted wholeWord
  // keeps the current setting.
  function replaceSession(session) {
    if (Array.isArray(session.families)) state.families = session.families;
    if (session.activeFamilyId != null) state.activeFamilyId = session.activeFamilyId;
    if (typeof session.resumeText === 'string') state.resumeText = session.resumeText;
    if (typeof session.keywordSearch === 'string') state.keywordSearch = session.keywordSearch;
    if (typeof session.copyFamilySelection === 'string') state.copyFamilySelection = session.copyFamilySelection;
    if (typeof session.wholeWord === 'boolean') state.wholeWord = session.wholeWord;
    notify();
  }

  return {
    getState,
    subscribe,
    getActiveFamily,
    setResumeText,
    setWholeWord,
    setKeywordSearch,
    setCopyFamilySelection,
    setActiveFamily,
    setActiveFamilyKeywords,
    setActiveFamilyName,
    addFamily,
    deleteActiveFamily,
    replaceSession,
  };
}
