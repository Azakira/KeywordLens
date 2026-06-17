// state.js — the single in-memory source of truth: shared families, the active
// family, the resume tabs (each with its own text) and active tab, the occurrence
// scope, and matching/filter settings, with mutators and a subscribe/notify
// channel. No DOM access; the render layer subscribes and repaints from getState().
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
    // A fresh session starts with one empty resume tab. Families are shared
    // across every resume; only the text is per-tab.
    resumes: [{ id: 1, name: 'Resume 1', text: '' }],
    activeResumeId: 1,
    // Occurrence scope: count against the active resume only, or aggregate
    // across all resume tabs. Highlighting always tracks the active tab.
    scope: 'active',
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

  function getActiveResume() {
    return state.resumes.find((resume) => resume.id === state.activeResumeId) || state.resumes[0];
  }

  function setResumeText(value) {
    getActiveResume().text = String(value);
    notify();
  }

  function setScope(value) {
    state.scope = value === 'all' ? 'all' : 'active';
    notify();
  }

  function setActiveResume(id) {
    state.activeResumeId = Number(id);
    notify();
  }

  function setActiveResumeName(value) {
    getActiveResume().name = String(value);
    notify();
  }

  function renameResume(id, value) {
    const resume = state.resumes.find((entry) => entry.id === Number(id));
    if (!resume) return;
    resume.name = String(value);
    notify();
  }

  function addResume() {
    const nextId = Math.max(0, ...state.resumes.map((resume) => resume.id)) + 1;
    state.resumes.push({ id: nextId, name: `Resume ${state.resumes.length + 1}`, text: '' });
    state.activeResumeId = nextId;
    notify();
    return nextId;
  }

  // Delete a resume tab by id. If it was the active tab, the previous neighbor
  // becomes active. Refuses to delete the last remaining tab; ignores unknown ids.
  function deleteResume(id) {
    id = Number(id);
    if (state.resumes.length <= 1) return false;
    const index = state.resumes.findIndex((resume) => resume.id === id);
    if (index === -1) return false;
    state.resumes = state.resumes.filter((resume) => resume.id !== id);
    if (state.activeResumeId === id) {
      const nextResume = state.resumes[Math.max(0, index - 1)] || state.resumes[0];
      state.activeResumeId = nextResume.id;
    }
    notify();
    return true;
  }

  function deleteActiveResume() {
    return deleteResume(state.activeResumeId);
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
    if (Array.isArray(session.resumes)) state.resumes = session.resumes;
    if (session.activeResumeId != null) state.activeResumeId = session.activeResumeId;
    if (session.scope === 'active' || session.scope === 'all') state.scope = session.scope;
    if (typeof session.keywordSearch === 'string') state.keywordSearch = session.keywordSearch;
    if (typeof session.copyFamilySelection === 'string') state.copyFamilySelection = session.copyFamilySelection;
    if (typeof session.wholeWord === 'boolean') state.wholeWord = session.wholeWord;
    notify();
  }

  return {
    getState,
    subscribe,
    getActiveFamily,
    getActiveResume,
    setResumeText,
    setScope,
    setActiveResume,
    setActiveResumeName,
    renameResume,
    addResume,
    deleteResume,
    deleteActiveResume,
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
