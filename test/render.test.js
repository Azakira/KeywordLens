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
