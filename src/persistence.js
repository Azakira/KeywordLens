// persistence.js — session serialization, untrusted-input sanitization, and the
// localStorage/sessionStorage read/write surface.
//
// The pure half (buildSessionPayload / sanitizeLoadedFamilies / extractSession)
// is the only place imported or stored JSON is validated before it reaches the
// app's state. The storage wrappers are thin and take an injectable storage ref
// so they can be unit-tested under jsdom. The schema version is stamped but never
// migrated: a stale or mismatched payload is rejected so the caller can fail safe
// to defaults rather than crash.

import { COLOR_CLASS_COUNT, normalizeColorIndex } from './palette.js';

export const APP_ID = 'local-resume-keyword-highlighter';
export const SCHEMA_VERSION = 1;

// Storage namespaces keep their legacy cache-bust suffixes so existing user saves
// are not orphaned.
export const AUTOSAVE_KEY = 'local-resume-keyword-highlighter:auto-session:v5';
export const HISTORY_KEY = 'local-resume-keyword-highlighter:history:v7';
export const MAX_HISTORY_ENTRIES = 40;

const PERCENT = /^\d+(\.\d+)?%$/;

// Wrap a plain session object with app/version metadata for storage or export.
export function buildSessionPayload(session, source = 'manual') {
  return {
    app: APP_ID,
    version: SCHEMA_VERSION,
    source,
    savedAt: new Date().toISOString(),
    ...session,
  };
}

// Validate/sanitize a families array from an untrusted payload. Returns a cleaned
// array with unique ids and in-range colors, or null if nothing usable remains.
export function sanitizeLoadedFamilies(inputFamilies) {
  if (!Array.isArray(inputFamilies)) return null;

  const cleaned = inputFamilies
    .map((family, index) => ({
      id: Number.isFinite(Number(family.id)) ? Number(family.id) : index + 1,
      name: String(family.name || `Family ${index + 1}`),
      colorIndex: Number.isFinite(Number(family.colorIndex))
        ? Number(family.colorIndex) % COLOR_CLASS_COUNT
        : index % COLOR_CLASS_COUNT,
      keywords: String(family.keywords || ''),
    }))
    .filter((family) => family.name || family.keywords);

  if (!cleaned.length) return null;

  const usedIds = new Set();
  cleaned.forEach((family, index) => {
    if (usedIds.has(family.id) || family.id <= 0) family.id = index + 1;
    while (usedIds.has(family.id)) family.id += 1;
    usedIds.add(family.id);
    family.colorIndex = normalizeColorIndex(family.colorIndex);
  });

  return cleaned;
}

// Turn an untrusted payload into a normalized session object the app can apply.
// Throws if there are no valid families (the caller fails safe to defaults).
// Optional fields (wholeWord, leftWidth, rightTopHeight) are present only when the
// payload carries a usable value, so callers can keep current state otherwise.
export function extractSession(payload) {
  const families = sanitizeLoadedFamilies(payload.families);
  if (!families) throw new Error('No valid keyword families found.');

  const activeFamilyId = families.some((family) => family.id === Number(payload.activeFamilyId))
    ? Number(payload.activeFamilyId)
    : families[0].id;

  const session = {
    families,
    activeFamilyId,
    resumeText: String(payload.resumeText || ''),
    keywordSearch: String(payload.keywordSearch || ''),
    copyFamilySelection: payload.copyFamilySelection ? String(payload.copyFamilySelection) : 'all',
  };

  if (typeof payload.wholeWord === 'boolean') {
    session.wholeWord = payload.wholeWord;
  }
  if (typeof payload.leftWidth === 'string' && PERCENT.test(payload.leftWidth.trim())) {
    session.leftWidth = payload.leftWidth.trim();
  }
  if (typeof payload.rightTopHeight === 'string' && PERCENT.test(payload.rightTopHeight.trim())) {
    session.rightTopHeight = payload.rightTopHeight.trim();
  }

  return session;
}

// ---- Storage I/O (thin wrappers; callers handle try/catch + UI status) --------

export function saveAutosave(payload, storage = globalThis.localStorage) {
  storage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
}

export function readAutosave(storage = globalThis.localStorage) {
  const raw = storage.getItem(AUTOSAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearStoredSession(
  localStorageRef = globalThis.localStorage,
  sessionStorageRef = globalThis.sessionStorage
) {
  localStorageRef.removeItem(AUTOSAVE_KEY);
  sessionStorageRef.removeItem(HISTORY_KEY);
}

export function saveHistory(stacks, storage = globalThis.sessionStorage) {
  storage.setItem(HISTORY_KEY, JSON.stringify(stacks));
}

export function readHistory(storage = globalThis.sessionStorage) {
  const raw = storage.getItem(HISTORY_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return {
    undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack : [],
    redoStack: Array.isArray(parsed.redoStack) ? parsed.redoStack : [],
  };
}
