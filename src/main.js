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

    const colorClassCount = 6;
    const autosaveKey = 'local-resume-keyword-highlighter:auto-session:v5';
    const historyKey = 'local-resume-keyword-highlighter:history:v7';
    const maxHistoryEntries = 40;
    let autosaveTimer = null;
    let historyTimer = null;
    let undoStack = [];
    let redoStack = [];
    let isApplyingHistory = false;
    let activeFamilyId = 1;
    let families = [
      { id: 1, name: 'Technical skills', colorIndex: 0, keywords: '' },
      { id: 2, name: 'Business skills', colorIndex: 1, keywords: '' },
      { id: 3, name: 'Tools', colorIndex: 2, keywords: '' }
    ];

    function getSessionPayload(source = 'manual') {
      return {
        app: 'local-resume-keyword-highlighter',
        version: 1,
        source,
        savedAt: new Date().toISOString(),
        resumeText: resumeText.value,
        activeFamilyId,
        wholeWord: wholeWordToggle.checked,
        keywordSearch: keywordSearch.value,
        copyFamilySelection: copyFamilySelect.value || 'all',
        leftWidth: getComputedStyle(document.documentElement).getPropertyValue('--left-width').trim(),
        rightTopHeight: getComputedStyle(document.documentElement).getPropertyValue('--right-top-height').trim(),
        families
      };
    }

    function setAutosaveStatus(message) {
      autosaveStatus.textContent = message;
    }

    function saveAutosaveNow() {
      try {
        localStorage.setItem(autosaveKey, JSON.stringify(getSessionPayload('autosave')));
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

    function getHistorySnapshot() {
      return JSON.stringify({
        resumeText: resumeText.value,
        activeFamilyId,
        wholeWord: wholeWordToggle.checked,
        keywordSearch: keywordSearch.value,
        copyFamilySelection: copyFamilySelect.value || 'all',
        leftWidth: getComputedStyle(document.documentElement).getPropertyValue('--left-width').trim(),
        rightTopHeight: getComputedStyle(document.documentElement).getPropertyValue('--right-top-height').trim(),
        families: JSON.parse(JSON.stringify(families))
      });
    }

    function saveHistoryState() {
      try {
        sessionStorage.setItem(historyKey, JSON.stringify({ undoStack, redoStack }));
      } catch (err) {
        while (undoStack.length > 10) undoStack.shift();
        redoStack = [];
        try {
          sessionStorage.setItem(historyKey, JSON.stringify({ undoStack, redoStack }));
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
        if (undoStack.length > maxHistoryEntries) undoStack.shift();
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
        const raw = sessionStorage.getItem(historyKey);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        undoStack = Array.isArray(parsed.undoStack) ? parsed.undoStack : [];
        redoStack = Array.isArray(parsed.redoStack) ? parsed.redoStack : [];
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
        applySessionPayload(JSON.parse(snapshot));
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

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function parseKeywords(input) {
      const seen = new Set();
      return input
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
        .filter(k => {
          const lower = k.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
    }

    function getActiveFamily() {
      return families.find(family => family.id === activeFamilyId) || families[0];
    }

    function getAllKeywordEntries() {
      const globalSeen = new Set();
      const entries = [];

      families.forEach(family => {
        parseKeywords(family.keywords).forEach(keyword => {
          const lower = keyword.toLowerCase();
          if (globalSeen.has(lower)) return;
          globalSeen.add(lower);
          entries.push({
            keyword,
            familyId: family.id,
            familyName: family.name,
            colorIndex: family.colorIndex
          });
        });
      });

      return entries;
    }

    function buildRegex(keyword, global = true) {
      const escaped = escapeRegex(keyword);
      const flags = global ? 'gi' : 'i';

      if (!wholeWordToggle.checked) {
        return new RegExp(escaped, flags);
      }

      return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, flags);
    }

    function countOccurrences(text, keyword) {
      if (!text || !keyword) return 0;
      const matches = text.match(buildRegex(keyword, true));
      return matches ? matches.length : 0;
    }

    function findEntryForMatch(matchText, entriesByLower) {
      return entriesByLower.get(matchText.toLowerCase());
    }

    function highlightText(text, keywordEntries) {
      if (!text) return '';
      if (!keywordEntries.length) return escapeHtml(text);

      const sorted = [...keywordEntries].sort((a, b) => b.keyword.length - a.keyword.length);
      const pattern = sorted.map(entry => escapeRegex(entry.keyword)).join('|');
      const boundaryStart = wholeWordToggle.checked ? '(?<![A-Za-z0-9_])' : '';
      const boundaryEnd = wholeWordToggle.checked ? '(?![A-Za-z0-9_])' : '';
      const regex = new RegExp(`${boundaryStart}(${pattern})${boundaryEnd}`, 'gi');
      const entriesByLower = new Map(sorted.map(entry => [entry.keyword.toLowerCase(), entry]));

      let result = '';
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const entry = findEntryForMatch(match[0], entriesByLower);
        const familyTitle = entry ? `${entry.familyName}: ${match[0]}` : match[0];
        const familyClass = entry ? `family-${entry.colorIndex}` : 'family-0';

        result += escapeHtml(text.slice(lastIndex, match.index));
        result += `<mark class="${familyClass}" title="${escapeHtml(familyTitle)}">${escapeHtml(match[0])}</mark>`;
        lastIndex = regex.lastIndex;

        if (match.index === regex.lastIndex) regex.lastIndex++;
      }

      result += escapeHtml(text.slice(lastIndex));
      return result;
    }

    function cssVar(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function renderTabs() {
      keywordTabs.innerHTML = families.map(family => `
        <button class="tab-btn ${family.id === activeFamilyId ? 'active' : ''}" type="button" data-family-id="${family.id}">
          <span class="color-dot" style="background:${cssVar(`--family-${family.colorIndex}`)}"></span>
          <span class="tab-name">${escapeHtml(family.name || 'Untitled')}</span>
        </button>
      `).join('');
    }

    function renderFamilyEditor() {
      const activeFamily = getActiveFamily();
      familyNameInput.value = activeFamily.name;
      keywordsText.value = activeFamily.keywords;
      deleteFamilyBtn.disabled = families.length <= 1;
    }

    function renderCopySelector() {
      const previous = copyFamilySelect.value || 'all';
      copyFamilySelect.innerHTML = [
        '<option value="all">All families</option>',
        ...families.map(family => `<option value="${family.id}">${escapeHtml(family.name || 'Untitled')}</option>`)
      ].join('');
      if ([...copyFamilySelect.options].some(option => option.value === previous)) {
        copyFamilySelect.value = previous;
      }
    }

    function renderFamilyRecap(rowsByFamily) {
      if (!rowsByFamily.length) {
        familyRecap.innerHTML = '';
        return;
      }

      familyRecap.innerHTML = rowsByFamily.map(group => {
        const total = group.rows.reduce((sum, row) => sum + row.count, 0);
        return `
          <span class="recap-pill" title="${escapeHtml(group.familyName || 'Untitled')}: ${total} occurrences">
            <span class="color-dot" style="background:${cssVar(`--family-${group.colorIndex}`)}"></span>${total}
          </span>
        `;
      }).join('');
    }

    function renderStats(rowsByFamily) {
      if (!rowsByFamily.length) {
        stats.innerHTML = '<div class="empty-state">Paste comma-separated keywords in one or more tabs below to begin.</div>';
        return;
      }

      const filter = keywordSearch.value.trim().toLowerCase();
      const selectedFamily = copyFamilySelect.value || 'all';
      const familyFilteredGroups = selectedFamily === 'all'
        ? rowsByFamily
        : rowsByFamily.filter(group => String(group.familyId) === String(selectedFamily));
      let visibleRows = 0;

      const html = familyFilteredGroups.map(group => {
        const filteredRows = filter
          ? group.rows.filter(row => row.keyword.toLowerCase().includes(filter))
          : group.rows;

        if (!filteredRows.length) return '';
        visibleRows += filteredRows.length;

        const total = filteredRows.reduce((sum, row) => sum + row.count, 0);
        const rowHtml = filteredRows.map(row => {
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
        }).join('');

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
      }).join('');

      stats.innerHTML = html || '<div class="empty-state">No keywords match the current family/search filter.</div>';
    }

    function computeRowsByFamily(text) {
      return families.map(family => {
        const rows = parseKeywords(family.keywords).map(keyword => ({
          keyword,
          count: countOccurrences(text, keyword)
        })).sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.keyword.localeCompare(b.keyword);
        });

        return {
          familyId: family.id,
          familyName: family.name,
          colorIndex: family.colorIndex,
          rows
        };
      }).filter(group => group.rows.length > 0);
    }

    function render() {
      const text = resumeText.value;
      const entries = getAllKeywordEntries();
      keywordCount.textContent = entries.length;
      familyCount.textContent = families.length;

      const rowsByFamily = computeRowsByFamily(text);

      renderTabs();
      renderCopySelector();
      renderFamilyRecap(rowsByFamily);
      renderStats(rowsByFamily);
      const highlighted = highlightText(text, entries);
      highlightOutput.classList.toggle('placeholder', !text);
      highlightOutput.innerHTML = highlighted || 'Paste resume text here...';
      syncResumeScroll();
    }

    function syncResumeScroll() {
      highlightOutput.scrollTop = resumeText.scrollTop;
      highlightOutput.scrollLeft = resumeText.scrollLeft;
    }

    resumeText.addEventListener('input', () => { render(); scheduleAutosave(); });
    resumeText.addEventListener('scroll', syncResumeScroll);
    wholeWordToggle.addEventListener('change', () => { render(); scheduleAutosave(); });
    keywordSearch.addEventListener('input', () => { render(); scheduleAutosave(); });
    copyFamilySelect.addEventListener('change', () => { render(); scheduleAutosave(); });

    keywordsText.addEventListener('input', () => {
      const activeFamily = getActiveFamily();
      activeFamily.keywords = keywordsText.value;
      render();
      scheduleAutosave();
    });

    familyNameInput.addEventListener('input', () => {
      const activeFamily = getActiveFamily();
      activeFamily.name = familyNameInput.value;
      render();
      scheduleAutosave();
    });

    keywordTabs.addEventListener('click', event => {
      const button = event.target.closest('[data-family-id]');
      if (!button) return;
      activeFamilyId = Number(button.dataset.familyId);
      renderTabs();
      renderFamilyEditor();
      render();
      scheduleAutosave();
      keywordsText.focus();
    });

    addFamilyBtn.addEventListener('click', () => {
      const nextId = Math.max(0, ...families.map(family => family.id)) + 1;
      const nextColorIndex = families.length % colorClassCount;
      families.push({
        id: nextId,
        name: `Family ${families.length + 1}`,
        colorIndex: nextColorIndex,
        keywords: ''
      });
      activeFamilyId = nextId;
      renderTabs();
      renderFamilyEditor();
      render();
      scheduleAutosave();
      familyNameInput.focus();
      familyNameInput.select();
    });

    deleteFamilyBtn.addEventListener('click', () => {
      if (families.length <= 1) return;
      const activeIndex = families.findIndex(family => family.id === activeFamilyId);
      families = families.filter(family => family.id !== activeFamilyId);
      const nextFamily = families[Math.max(0, activeIndex - 1)] || families[0];
      activeFamilyId = nextFamily.id;
      renderTabs();
      renderFamilyEditor();
      render();
      scheduleAutosave();
    });

    function sanitizeLoadedFamilies(inputFamilies) {
      if (!Array.isArray(inputFamilies)) return null;

      const cleaned = inputFamilies.map((family, index) => ({
        id: Number.isFinite(Number(family.id)) ? Number(family.id) : index + 1,
        name: String(family.name || `Family ${index + 1}`),
        colorIndex: Number.isFinite(Number(family.colorIndex)) ? Number(family.colorIndex) % colorClassCount : index % colorClassCount,
        keywords: String(family.keywords || '')
      })).filter(family => family.name || family.keywords);

      if (!cleaned.length) return null;

      const usedIds = new Set();
      cleaned.forEach((family, index) => {
        if (usedIds.has(family.id) || family.id <= 0) family.id = index + 1;
        while (usedIds.has(family.id)) family.id += 1;
        usedIds.add(family.id);
        family.colorIndex = ((family.colorIndex % colorClassCount) + colorClassCount) % colorClassCount;
      });

      return cleaned;
    }

    function applySessionPayload(payload, options = {}) {
      const loadedFamilies = sanitizeLoadedFamilies(payload.families);
      if (!loadedFamilies) throw new Error('No valid keyword families found.');

      families = loadedFamilies;
      activeFamilyId = families.some(family => family.id === Number(payload.activeFamilyId))
        ? Number(payload.activeFamilyId)
        : families[0].id;

      resumeText.value = String(payload.resumeText || '');

      if (typeof payload.wholeWord === 'boolean') {
        wholeWordToggle.checked = payload.wholeWord;
      }

      keywordSearch.value = String(payload.keywordSearch || '');

      if (typeof payload.leftWidth === 'string' && /^\d+(\.\d+)?%$/.test(payload.leftWidth.trim())) {
        document.documentElement.style.setProperty('--left-width', payload.leftWidth.trim());
      }

      if (typeof payload.rightTopHeight === 'string' && /^\d+(\.\d+)?%$/.test(payload.rightTopHeight.trim())) {
        document.documentElement.style.setProperty('--right-top-height', payload.rightTopHeight.trim());
      }

      renderTabs();
      renderFamilyEditor();
      render();

      if (payload.copyFamilySelection) {
        copyFamilySelect.value = [...copyFamilySelect.options].some(option => option.value === String(payload.copyFamilySelection))
          ? String(payload.copyFamilySelection)
          : 'all';
      }

      if (options.saveAfterApply) scheduleAutosave();
    }

    function loadAutosaveIfPresent() {
      try {
        const raw = localStorage.getItem(autosaveKey);
        if (!raw) return false;
        applySessionPayload(JSON.parse(raw));
        setAutosaveStatus('Autosave restored');
        return true;
      } catch (err) {
        setAutosaveStatus('Autosave unreadable');
        return false;
      }
    }

    undoBtn.addEventListener('click', undoSession);

    redoBtn.addEventListener('click', redoSession);

    window.addEventListener('keydown', event => {
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
    }, true);

    saveSessionBtn.addEventListener('click', () => {
      const payload = getSessionPayload('manual-download');
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
          applySessionPayload(payload, { saveAfterApply: true });
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
        localStorage.removeItem(autosaveKey);
        sessionStorage.removeItem(historyKey);
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
      render();
      scheduleAutosave();
      resumeText.focus();
    });

    clearKeywordsBtn.addEventListener('click', () => {
      const activeFamily = getActiveFamily();
      activeFamily.keywords = '';
      renderFamilyEditor();
      render();
      scheduleAutosave();
      keywordsText.focus();
    });

    copyMissingBtn.addEventListener('click', async () => {
      const text = resumeText.value;
      const selected = copyFamilySelect.value;
      const selectedFamilies = selected === 'all'
        ? families
        : families.filter(family => String(family.id) === selected);

      const missingByFamily = selectedFamilies.map(family => {
        const missing = parseKeywords(family.keywords)
          .filter(keyword => countOccurrences(text, keyword) === 0);
        return { familyName: family.name, missing };
      }).filter(group => group.missing.length > 0);

      const output = missingByFamily
        .map(group => selected === 'all' ? `${group.familyName}: ${group.missing.join(', ')}` : group.missing.join(', '))
        .join('\n');

      try {
        await navigator.clipboard.writeText(output);
        copyMissingBtn.textContent = 'Copied';
        setTimeout(() => copyMissingBtn.textContent = 'Copy missing', 1000);
      } catch (err) {
        alert('Could not copy to clipboard. Missing keywords:\n\n' + output);
      }
    });

    let isDragging = false;

    splitter.addEventListener('mousedown', () => {
      isDragging = true;
      splitter.classList.add('dragging');
      document.body.classList.add('resizing');
    });

    window.addEventListener('mousemove', event => {
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

    window.addEventListener('mousemove', event => {
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

    if (!loadAutosaveIfPresent()) {
      renderTabs();
      renderFamilyEditor();
      render();
      saveAutosaveNow();
    }

    if (!loadHistoryState() || undoStack[undoStack.length - 1] !== getHistorySnapshot()) {
      undoStack = [getHistorySnapshot()];
      redoStack = [];
      saveHistoryState();
      updateHistoryButtons();
    }
