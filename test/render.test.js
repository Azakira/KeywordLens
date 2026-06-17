import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { initApp } from '../src/render.js';

// Boot the real app shell into jsdom so the render/event wiring is exercised
// end-to-end against the live index.html markup (light DOM smoke test).
const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const bodyInner = html
  .match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '');

function type(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input'));
}

describe('app wiring (jsdom smoke)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = bodyInner;
    initApp();
  });

  it('boots with the three default family tabs', () => {
    expect(document.querySelectorAll('#keywordTabs .tab-btn')).toHaveLength(3);
    expect(document.getElementById('familyCount').textContent).toBe('3');
  });

  it('highlights resume text that matches a keyword', () => {
    type(document.getElementById('keywordsText'), 'SQL');
    type(document.getElementById('resumeText'), 'I use SQL daily');

    const out = document.getElementById('highlightOutput').innerHTML;
    expect(out).toContain('<mark');
    expect(out).toContain('SQL');
    expect(document.getElementById('keywordCount').textContent).toBe('1');
  });

  it('renders an occurrences row with a present count', () => {
    type(document.getElementById('keywordsText'), 'Python');
    type(document.getElementById('resumeText'), 'Python and Python');

    const stats = document.getElementById('stats').textContent;
    expect(stats).toContain('Python');
    expect(stats).toContain('present');
    expect(document.querySelector('#stats .count').textContent).toBe('2');
  });

  it('adds a family tab and lists it in the copy selector', () => {
    document.getElementById('addFamilyBtn').dispatchEvent(new Event('click'));
    expect(document.querySelectorAll('#keywordTabs .tab-btn')).toHaveLength(4);
    expect(document.querySelectorAll('#copyFamilySelect option')).toHaveLength(5); // "All" + 4
  });

  it('places the whole-words toggle in the occurrences toolbar', () => {
    const toggle = document.getElementById('wholeWordToggle');
    expect(toggle.closest('.stats-toolbar')).not.toBeNull();
    // and no longer in the resume panel header
    expect(toggle.closest('.panel-header')).toBeNull();
  });

  it('toggling whole-words recomputes highlight and counts', () => {
    type(document.getElementById('keywordsText'), 'Java');
    type(document.getElementById('resumeText'), 'JavaScript developer');

    // whole-words on by default: the substring inside "JavaScript" is suppressed
    expect(document.getElementById('highlightOutput').innerHTML).not.toContain('<mark');
    expect(document.querySelector('#stats .badge').textContent).toBe('missing');

    const toggle = document.getElementById('wholeWordToggle');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    expect(document.getElementById('highlightOutput').innerHTML).toContain('<mark');
    expect(document.querySelector('#stats .count').textContent).toBe('1');
  });

  it('persists the whole-words setting across reload', () => {
    const toggle = document.getElementById('wholeWordToggle');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    window.dispatchEvent(new Event('beforeunload'));
    document.body.innerHTML = bodyInner;
    initApp();

    expect(document.getElementById('wholeWordToggle').checked).toBe(false);
  });

  it('boots with one resume tab and adds another', () => {
    expect(document.querySelectorAll('#resumeTabs .resume-tab')).toHaveLength(1);
    document.getElementById('addResumeBtn').dispatchEvent(new Event('click'));
    expect(document.querySelectorAll('#resumeTabs .resume-tab')).toHaveLength(2);
  });

  it('shows a close button only when more than one tab exists', () => {
    expect(document.querySelector('#resumeTabs .resume-tab-close')).toBeNull();
    document.getElementById('addResumeBtn').dispatchEvent(new Event('click'));
    expect(document.querySelectorAll('#resumeTabs .resume-tab-close')).toHaveLength(2);
  });

  it('deletes a resume tab via its close button', () => {
    document.getElementById('addResumeBtn').dispatchEvent(new Event('click'));
    expect(document.querySelectorAll('#resumeTabs .resume-tab')).toHaveLength(2);

    document
      .querySelector('#resumeTabs .resume-tab-close')
      .dispatchEvent(new Event('click', { bubbles: true }));

    expect(document.querySelectorAll('#resumeTabs .resume-tab')).toHaveLength(1);
    expect(document.querySelector('#resumeTabs .resume-tab-close')).toBeNull();
  });

  it('renames a resume tab via the pen icon', () => {
    document
      .querySelector('#resumeTabs .resume-tab-edit')
      .dispatchEvent(new Event('click', { bubbles: true }));

    const input = document.querySelector('#resumeTabs .resume-tab-rename');
    expect(input).not.toBeNull();
    input.value = 'Backend';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(document.querySelector('#resumeTabs .resume-tab-name').textContent).toBe('Backend');
  });

  it('accepts a multi-word tab name (spaces are not swallowed)', () => {
    document
      .querySelector('#resumeTabs .resume-tab-edit')
      .dispatchEvent(new Event('click', { bubbles: true }));
    const input = document.querySelector('#resumeTabs .resume-tab-rename');
    // The rename input must not be nested in the tab <button>, or the button would
    // intercept Space and end the rename before a multi-word name can be typed.
    expect(input.closest('.resume-tab')).toBeNull();
    input.value = 'Backend Engineer';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(document.querySelector('#resumeTabs .resume-tab-name').textContent).toBe('Backend Engineer');
  });

  it('renaming via the pen does not switch the active tab', () => {
    type(document.getElementById('resumeText'), 'first tab text');
    document.getElementById('addResumeBtn').dispatchEvent(new Event('click')); // tab 2 active

    // Click the pen on the FIRST tab; the second tab should stay active.
    document
      .querySelector('#resumeTabs .resume-tab .resume-tab-edit')
      .dispatchEvent(new Event('click', { bubbles: true }));
    const input = document.querySelector('#resumeTabs .resume-tab-rename');
    input.value = 'First';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // Active tab is still the (empty) second one, not the renamed first.
    expect(document.getElementById('resumeText').value).toBe('');
    const tabs = [...document.querySelectorAll('#resumeTabs .resume-tab')];
    expect(tabs[0].querySelector('.resume-tab-name').textContent).toBe('First');
    expect(tabs[1].classList.contains('active')).toBe(true);
  });

  it('keeps resume text per tab and highlights only the active tab', () => {
    type(document.getElementById('keywordsText'), 'SQL');
    type(document.getElementById('resumeText'), 'SQL on tab one');

    // New tab is empty and becomes active: highlight clears for the active tab.
    document.getElementById('addResumeBtn').dispatchEvent(new Event('click'));
    expect(document.getElementById('resumeText').value).toBe('');
    expect(document.getElementById('highlightOutput').innerHTML).not.toContain('<mark');

    // Switching back to the first tab restores its text and highlight.
    document.querySelector('#resumeTabs .resume-tab').dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.getElementById('resumeText').value).toBe('SQL on tab one');
    expect(document.getElementById('highlightOutput').innerHTML).toContain('<mark');
  });

  it('scope "all" aggregates counts across resume tabs', () => {
    type(document.getElementById('keywordsText'), 'SQL');
    type(document.getElementById('resumeText'), 'SQL here');

    document.getElementById('addResumeBtn').dispatchEvent(new Event('click'));
    type(document.getElementById('resumeText'), 'SQL and SQL there');

    // Active scope sees only the current (second) tab: 2 occurrences.
    expect(document.querySelector('#stats .count').textContent).toBe('2');

    const scope = document.getElementById('scopeSelect');
    scope.value = 'all';
    scope.dispatchEvent(new Event('change'));

    // All scope sums across both tabs: 1 + 2 = 3.
    expect(document.querySelector('#stats .count').textContent).toBe('3');
  });

  it('persists resume tabs and scope across reload', () => {
    type(document.getElementById('resumeText'), 'first');
    document.getElementById('addResumeBtn').dispatchEvent(new Event('click'));
    type(document.getElementById('resumeText'), 'second');
    const scope = document.getElementById('scopeSelect');
    scope.value = 'all';
    scope.dispatchEvent(new Event('change'));

    window.dispatchEvent(new Event('beforeunload'));
    document.body.innerHTML = bodyInner;
    initApp();

    expect(document.querySelectorAll('#resumeTabs .resume-tab')).toHaveLength(2);
    expect(document.getElementById('scopeSelect').value).toBe('all');
    expect(document.getElementById('resumeText').value).toBe('second');
  });

  it('persists an autosave that restores on the next boot', () => {
    type(document.getElementById('keywordsText'), 'Docker');
    type(document.getElementById('resumeText'), 'Docker containers');

    // Flush the debounced autosave the way a real unload would, then re-boot
    // into a fresh DOM; the autosave in localStorage should hydrate it.
    window.dispatchEvent(new Event('beforeunload'));
    document.body.innerHTML = bodyInner;
    initApp();

    expect(document.getElementById('resumeText').value).toBe('Docker containers');
    expect(document.getElementById('autosaveStatus').textContent).toBe('Autosave restored');
  });
});
