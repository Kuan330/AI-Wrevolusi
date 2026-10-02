import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/pages/Plan/learning-preview.css', import.meta.url), 'utf8');
const rule = selector => {
  const start = css.indexOf(`${selector}{`);
  assert.notEqual(start, -1, `Missing ${selector}`);
  return css.slice(start, css.indexOf('}', start) + 1);
};

test('schedule grows below workspace tabs and notices instead of clipping to the viewport', () => {
  for (const selector of ['main:has(> .lp-page)', '.lp-page']) {
    assert.match(rule(selector), /height:auto/);
    assert.match(rule(selector), /overflow:visible/);
  }
  assert.match(rule('.lp-layout'), /flex:none/);
  assert.match(rule('.lp-layout'), /align-items:start/);
});

test('calendar keeps readable rows for a complete six-week month', () => {
  assert.match(rule('.lp-mini-grid'), /grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(rule('.lp-mini-grid'), /grid-auto-rows:minmax\(44px,auto\)/);
  assert.match(rule('.lp-mini-grid>button'), /min-height:44px/);
});

test('course table retains its own bounded scrolling without limiting page height', () => {
  assert.match(rule('.lp-courses-table .dt-scroll'), /max-height:min\(65vh,32rem\)/);
  assert.match(rule('.lp-courses-table .dt-scroll'), /overflow:auto/);
});
