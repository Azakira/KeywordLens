// render.js — the thin DOM shell: element refs, render functions, event wiring,
// and the autosave/history orchestration. All matching/counting/serialization is
// delegated to the pure modules; this layer is the only one that touches the DOM.
//
// State ownership split:
//   - model + settings (families, activeFamilyId, resumeText, wholeWord,
//     keywordSearch, copyFamilySelection) live in `state`; render() is subscribed
//     and repaints on every mutation.
//   - layout dimensions live as CSS custom properties, read back at save time.
//   - the keyword-search input and copy-family <select> are seeded from state on
//     load and read back from state/DOM during render (never reset mid-typing).

import { escapeHtml, getAllKeywordEntries, highlightText, parseKeywords } from './highlight.js';
import { countOccurrences, computeRowsByFamily } from './stats.js';
import {
  buildSessionPayload,
  extractSession,
  saveAutosave,
  readAutosave,
  clearStoredSession,
  saveHistory,
  readHistory,
  MAX_HISTORY_ENTRIES,
} from './persistence.js';
import { createState } from './state.js';

export function initApp() {
  const mainLayout = document.getElementById('mainLayout');
  const splitter = document.getElementById('splitter');
  const horizontalSplitter = document.getElementById('horizontalSplitter');
  const resumeText = document.getElementById('resumeText');
  const keywordsText = document.getElementById('keywordsText');
  const stats = document.getElementById('stats');
  const highlightOutput = document.getElementById('highlightOutput');
  const keywordCount = document.getElementById('keywordCount');
  const familyCount = document.getElementById('familyCount');
  const familyRecap = document.getElementById('familyRecap');
  const keywordSearch = document.getElementById('keywordSearch');
  const copyFamilySelect = document.getElementById('copyFamilySelect');
  const wholeWordToggle = document.getElementById('wholeWordToggle');
  const clearResumeBtn = document.getElementById('clearResumeBtn');
  const clearKeywordsBtn = document.getElementById('clearKeywordsBtn');
  const copyMissingBtn = document.getElementById('copyMissingBtn');
  const keywordTabs = document.getElementById('keywordTabs');
  const addFamilyBtn = document.getElementById('addFamilyBtn');
  const deleteFamilyBtn = document.getElementById('deleteFamilyBtn');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const saveSessionBtn = document.getElementById('saveSessionBtn');
  const loadSessionBtn = document.getElementById('loadSessionBtn');
  const clearAutosaveBtn = document.getElementById('clearAutosaveBtn');
  const autosaveStatus = document.getElementById('autosaveStatus');
  const loadSessionInput = document.getElementById('loadSessionInput');
  const familyNameInput = document.getElementById('familyNameInput');

  const store = createState();

  let autosaveTimer = null;
  let historyTimer = null;
  let undoStack = [];
  let redoStack = [];
  let isApplyingHistory = false;

  // ---- session serialization helpers -----------------------------------------

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // The serializable session: model/settings from state, layout from CSS,
  // the copy-filter from its (already normalized) <select>.
  function currentSessionData() {
    const s = store.getState();
    return {
      resumeText: s.resumeText,
      activeFamilyId: s.activeFamilyId,
      wholeWord: s.wholeWord,
      keywordSearch: s.keywordSearch,
      copyFamilySelection: copyFamilySelect.value || 'all',
      leftWidth: cssVar('--left-width'),
      rightTopHeight: cssVar('--right-top-height'),
      families: s.families,
    };
  }

  function getHistorySnapshot() {
    return JSON.stringify(currentSessionData());
  }

  function setAutosaveStatus(message) {
    autosaveStatus.textContent = message;
  }

  function saveAutosaveNow() {
    try {
      saveAutosave(buildSessionPayload(currentSessionData(), 'autosave'));
      setAutosaveStatus('Autosaved');
    } catch (err) {
      setAutosaveStatus('Autosave unavailable');
    }
  }

  function scheduleAutosave() {
    setAutosaveStatus('Saving…');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveAutosaveNow, 250);
    scheduleHistoryCommit();
  }

  // ---- history (undo/redo) ----------------------------------------------------

  function saveHistoryState() {
    try {
      saveHistory({ undoStack, redoStack });
    } catch (err) {
      while (undoStack.length > 10) undoStack.shift();
      redoStack = [];
      try {
        saveHistory({ undoStack, redoStack });
      } catch (innerErr) {
        // History is optional. Autosave still works if storage quota is exhausted.
      }
    }
  }

  function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length <= 1;
    redoBtn.disabled = redoStack.length === 0;
  }

  function commitHistorySnapshot() {
    if (isApplyingHistory) return;
    const snapshot = getHistorySnapshot();
    if (undoStack[undoStack.length - 1] !== snapshot) {
      undoStack.push(snapshot);
      if (undoStack.length > MAX_HISTORY_ENTRIES) undoStack.shift();
      redoStack = [];
      saveHistoryState();
    }
    updateHistoryButtons();
  }

  function scheduleHistoryCommit() {
    if (isApplyingHistory) return;
    clearTimeout(historyTimer);
    historyTimer = setTimeout(commitHistorySnapshot, 350);
  }

  function loadHistoryState() {
    try {
      const stored = readHistory();
      if (!stored) return false;
      undoStack = stored.undoStack;
      redoStack = stored.redoStack;
      updateHistoryButtons();
      return undoStack.length > 0;
    } catch (err) {
      undoStack = [];
      redoStack = [];
      updateHistoryButtons();
      return false;
    }
  }

  function applyHistorySnapshot(snapshot, statusMessage) {
    isApplyingHistory = true;
    try {
      applyExtractedSession(extractSession(JSON.parse(snapshot)));
      saveAutosaveNow();
      setAutosaveStatus(statusMessage);
    } catch (err) {
      setAutosaveStatus('Could not restore history');
    } finally {
      isApplyingHistory = false;
      updateHistoryButtons();
      saveHistoryState();
    }
  }

  function undoSession() {
    clearTimeout(historyTimer);
    commitHistorySnapshot();
    if (undoStack.length <= 1) return;
    const current = undoStack.pop();
    redoStack.push(current);
    const previous = undoStack[undoStack.length - 1];
    applyHistorySnapshot(previous, 'Rolled back');
  }

  function redoSession() {
    clearTimeout(historyTimer);
    if (!redoStack.length) return;
    const next = redoStack.pop();
    undoStack.push(next);
    applyHistorySnapshot(next, 'Restored redo');
  }

  // ---- rendering --------------------------------------------------------------

  function renderTabs(s) {
    keywordTabs.innerHTML = s.families
      .map(
        (family) => `
        <button class="tab-btn ${family.id === s.activeFamilyId ? 'active' : ''}" type="button" data-family-id="${family.id}">
          <span class="color-dot" style="background:${cssVar(`--family-${family.colorIndex}`)}"></span>
          <span class="tab-name">${escapeHtml(family.name || 'Untitled')}</span>
        </button>
      `
      )
      .join('');
  }

  function renderFamilyEditor(s) {
    const activeFamily = store.getActiveFamily();
    familyNameInput.value = activeFamily.name;
    keywordsText.value = activeFamily.keywords;
    deleteFamilyBtn.disabled = s.families.length <= 1;
  }

  function renderCopySelector(s) {
    const desired = s.copyFamilySelection || 'all';
    copyFamilySelect.innerHTML = [
      '<option value="all">All families</option>',
      ...s.families.map(
        (family) => `<option value="${family.id}">${escapeHtml(family.name || 'Untitled')}</option>`
      ),
    ].join('');
    // Fall back to "all" if the previously selected family no longer exists.
    copyFamilySelect.value = [...copyFamilySelect.options].some((option) => option.value === desired)
      ? desired
      : 'all';
  }

  function renderFamilyRecap(rowsByFamily) {
    if (!rowsByFamily.length) {
      familyRecap.innerHTML = '';
      return;
    }

    familyRecap.innerHTML = rowsByFamily
      .map((group) => {
        const total = group.rows.reduce((sum, row) => sum + row.count, 0);
        return `
          <span class="recap-pill" title="${escapeHtml(group.familyName || 'Untitled')}: ${total} occurrences">
            <span class="color-dot" style="background:${cssVar(`--family-${group.colorIndex}`)}"></span>${total}
          </span>
        `;
      })
      .join('');
  }

  function renderStats(rowsByFamily, s) {
    if (!rowsByFamily.length) {
      stats.innerHTML = '<div class="empty-state">Paste comma-separated keywords in one or more tabs below to begin.</div>';
      return;
    }

    const filter = s.keywordSearch.trim().toLowerCase();
    const selectedFamily = copyFamilySelect.value || 'all';
    const familyFilteredGroups =
      selectedFamily === 'all'
        ? rowsByFamily
        : rowsByFamily.filter((group) => String(group.familyId) === String(selectedFamily));

    const html = familyFilteredGroups
      .map((group) => {
        const filteredRows = filter
          ? group.rows.filter((row) => row.keyword.toLowerCase().includes(filter))
          : group.rows;

        if (!filteredRows.length) return '';

        const total = filteredRows.reduce((sum, row) => sum + row.count, 0);
        const rowHtml = filteredRows
          .map((row) => {
            const present = row.count > 0;
            const borderColor = cssVar(`--family-${group.colorIndex}-border`);
            const bgColor = cssVar(`--family-${group.colorIndex}`);
            const presentStyle = `border-left-color:${borderColor}; background:linear-gradient(90deg, ${bgColor}55, #fff 48px);`;
            const missingStyle = 'border-left-color:transparent; background:#fff;';
            return `
            <div class="summary-row" style="${present ? presentStyle : missingStyle}">
              <div class="keyword-name">${escapeHtml(row.keyword)}</div>
              <div class="count">${row.count}</div>
              <div class="badge ${present ? 'present' : ''}">${present ? 'present' : 'missing'}</div>
            </div>
          `;
          })
          .join('');

        return `
          <div class="family-group">
            <div class="family-heading">
              <span class="family-label">
                <span class="color-dot" style="background:${cssVar(`--family-${group.colorIndex}`)}"></span>
                <span>${escapeHtml(group.familyName || 'Untitled')}</span>
              </span>
              <span>${total} shown</span>
            </div>
            ${rowHtml}
          </div>
        `;
      })
      .join('');

    stats.innerHTML = html || '<div class="empty-state">No keywords match the current family/search filter.</div>';
  }

  function render() {
    const s = store.getState();
    const entries = getAllKeywordEntries(s.families);
    keywordCount.textContent = entries.length;
    familyCount.textContent = s.families.length;

    const rowsByFamily = computeRowsByFamily(s.resumeText, s.families, { wholeWord: s.wholeWord });

    renderTabs(s);
    renderCopySelector(s);
    renderFamilyRecap(rowsByFamily);
    renderStats(rowsByFamily, s);

    const highlighted = highlightText(s.resumeText, entries, { wholeWord: s.wholeWord });
    highlightOutput.classList.toggle('placeholder', !s.resumeText);
    highlightOutput.innerHTML = highlighted || 'Paste resume text here...';
    syncResumeScroll();
  }

  function syncResumeScroll() {
    highlightOutput.scrollTop = resumeText.scrollTop;
    highlightOutput.scrollLeft = resumeText.scrollLeft;
  }

  // Sync DOM controls that render() deliberately does not touch (so they don't
  // fight the caret mid-typing), used after a load / undo / redo.
  function applyExtractedSession(session) {
    store.replaceSession(session); // updates model + triggers render via subscription
    const s = store.getState();
    resumeText.value = s.resumeText;
    wholeWordToggle.checked = s.wholeWord;
    keywordSearch.value = s.keywordSearch;
    renderFamilyEditor(s);

    if (session.copyFamilySelection) {
      copyFamilySelect.value = [...copyFamilySelect.options].some(
        (option) => option.value === String(session.copyFamilySelection)
      )
        ? String(session.copyFamilySelection)
        : 'all';
    }
    if (session.leftWidth) {
      document.documentElement.style.setProperty('--left-width', session.leftWidth);
    }
    if (session.rightTopHeight) {
      document.documentElement.style.setProperty('--right-top-height', session.rightTopHeight);
    }
  }

  // ---- event wiring -----------------------------------------------------------

  store.subscribe(render);

  resumeText.addEventListener('input', () => {
    store.setResumeText(resumeText.value);
    scheduleAutosave();
  });
  resumeText.addEventListener('scroll', syncResumeScroll);

  wholeWordToggle.addEventListener('change', () => {
    store.setWholeWord(wholeWordToggle.checked);
    scheduleAutosave();
  });

  keywordSearch.addEventListener('input', () => {
    store.setKeywordSearch(keywordSearch.value);
    scheduleAutosave();
  });

  copyFamilySelect.addEventListener('change', () => {
    store.setCopyFamilySelection(copyFamilySelect.value);
    scheduleAutosave();
  });

  keywordsText.addEventListener('input', () => {
    store.setActiveFamilyKeywords(keywordsText.value);
    scheduleAutosave();
  });

  familyNameInput.addEventListener('input', () => {
    store.setActiveFamilyName(familyNameInput.value);
    scheduleAutosave();
  });

  keywordTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-family-id]');
    if (!button) return;
    store.setActiveFamily(Number(button.dataset.familyId));
    renderFamilyEditor(store.getState());
    scheduleAutosave();
    keywordsText.focus();
  });

  addFamilyBtn.addEventListener('click', () => {
    store.addFamily();
    renderFamilyEditor(store.getState());
    scheduleAutosave();
    familyNameInput.focus();
    familyNameInput.select();
  });

  deleteFamilyBtn.addEventListener('click', () => {
    if (!store.deleteActiveFamily()) return;
    renderFamilyEditor(store.getState());
    scheduleAutosave();
  });

  undoBtn.addEventListener('click', undoSession);
  redoBtn.addEventListener('click', redoSession);

  window.addEventListener(
    'keydown',
    (event) => {
      const modifierPressed = event.ctrlKey || event.metaKey;
      if (!modifierPressed) return;

      const key = event.key.toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = (key === 'z' && event.shiftKey) || key === 'y';

      if (wantsUndo) {
        event.preventDefault();
        undoSession();
      } else if (wantsRedo) {
        event.preventDefault();
        redoSession();
      }
    },
    true
  );

  saveSessionBtn.addEventListener('click', () => {
    const payload = buildSessionPayload(currentSessionData(), 'manual-download');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `resume-keyword-session-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  loadSessionBtn.addEventListener('click', () => {
    loadSessionInput.click();
  });

  loadSessionInput.addEventListener('change', () => {
    const file = loadSessionInput.files && loadSessionInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'));
        applyExtractedSession(extractSession(payload));
        scheduleAutosave();
      } catch (err) {
        alert('Could not load this JSON session file.');
      } finally {
        loadSessionInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  clearAutosaveBtn.addEventListener('click', () => {
    try {
      clearStoredSession();
      undoStack = [getHistorySnapshot()];
      redoStack = [];
      updateHistoryButtons();
      setAutosaveStatus('Autosave cleared');
    } catch (err) {
      setAutosaveStatus('Could not clear autosave');
    }
  });

  clearResumeBtn.addEventListener('click', () => {
    resumeText.value = '';
    store.setResumeText('');
    scheduleAutosave();
    resumeText.focus();
  });

  clearKeywordsBtn.addEventListener('click', () => {
    store.setActiveFamilyKeywords('');
    renderFamilyEditor(store.getState());
    scheduleAutosave();
    keywordsText.focus();
  });

  copyMissingBtn.addEventListener('click', async () => {
    const s = store.getState();
    const text = s.resumeText;
    const selected = copyFamilySelect.value;
    const selectedFamilies =
      selected === 'all' ? s.families : s.families.filter((family) => String(family.id) === selected);

    const missingByFamily = selectedFamilies
      .map((family) => {
        const missing = parseKeywords(family.keywords).filter(
          (keyword) => countOccurrences(text, keyword, { wholeWord: s.wholeWord }) === 0
        );
        return { familyName: family.name, missing };
      })
      .filter((group) => group.missing.length > 0);

    const output = missingByFamily
      .map((group) =>
        selected === 'all' ? `${group.familyName}: ${group.missing.join(', ')}` : group.missing.join(', ')
      )
      .join('\n');

    try {
      await navigator.clipboard.writeText(output);
      copyMissingBtn.textContent = 'Copied';
      setTimeout(() => (copyMissingBtn.textContent = 'Copy missing'), 1000);
    } catch (err) {
      alert('Could not copy to clipboard. Missing keywords:\n\n' + output);
    }
  });

  // ---- splitters --------------------------------------------------------------

  let isDragging = false;

  splitter.addEventListener('mousedown', () => {
    isDragging = true;
    splitter.classList.add('dragging');
    document.body.classList.add('resizing');
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    const rect = mainLayout.getBoundingClientRect();
    const rawPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const boundedPercent = Math.min(78, Math.max(35, rawPercent));
    document.documentElement.style.setProperty('--left-width', `${boundedPercent}%`);
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    splitter.classList.remove('dragging');
    document.body.classList.remove('resizing');
    scheduleAutosave();
  });

  let isHorizontalDragging = false;

  horizontalSplitter.addEventListener('mousedown', () => {
    isHorizontalDragging = true;
    horizontalSplitter.classList.add('dragging');
    document.body.classList.add('vertical-resizing');
  });

  window.addEventListener('mousemove', (event) => {
    if (!isHorizontalDragging) return;
    const rect = horizontalSplitter.parentElement.getBoundingClientRect();
    const rawPercent = ((event.clientY - rect.top) / rect.height) * 100;
    const boundedPercent = Math.min(78, Math.max(28, rawPercent));
    document.documentElement.style.setProperty('--right-top-height', `${boundedPercent}%`);
  });

  window.addEventListener('mouseup', () => {
    if (!isHorizontalDragging) return;
    isHorizontalDragging = false;
    horizontalSplitter.classList.remove('dragging');
    document.body.classList.remove('vertical-resizing');
    scheduleAutosave();
  });

  window.addEventListener('beforeunload', saveAutosaveNow);

  // ---- boot -------------------------------------------------------------------

  function loadAutosaveIfPresent() {
    try {
      const payload = readAutosave();
      if (!payload) return false;
      applyExtractedSession(extractSession(payload));
      setAutosaveStatus('Autosave restored');
      return true;
    } catch (err) {
      setAutosaveStatus('Autosave unreadable');
      return false;
    }
  }

  if (!loadAutosaveIfPresent()) {
    renderFamilyEditor(store.getState());
    render();
    saveAutosaveNow();
  }

  if (!loadHistoryState() || undoStack[undoStack.length - 1] !== getHistorySnapshot()) {
    undoStack = [getHistorySnapshot()];
    redoStack = [];
    saveHistoryState();
    updateHistoryButtons();
  }
}
