/** Offline regression for recognition readiness, partial transcripts and cancellation. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AIW_QA_ORIGIN || 'http://127.0.0.1:5194';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || 'chrome' });
const context = await browser.newContext();
await context.addInitScript(() => {
  globalThis.__speech = [];
  globalThis.SpeechRecognition = class {
    constructor() { globalThis.__speech.push(this); }
    start() {}
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  };
});
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const json = (route, body) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const path = url.pathname.replace('/api/v1', '');
  if (path === '/account/me') return json(route, { id: 'qa-voice', username: 'qa-voice' });
  if (path === '/account/workspace') return json(route, { owner_id: 'qa-voice', data: {}, revision: 0 });
  if (path === '/interview/question-bank') return json(route, { occupation_code: '0000', matched: 'common', questions: [] });
  if (path === '/interview/plan') return json(route, { source: 'template', questions: [{ text: 'Tell me about your work.', kind: 'general', item_id: null, topic_id: null, bank_id: null }] });
  if (path === '/reference/wef-skills') return json(route, []);
  return json(route, {});
});
const emit = (pieces, resultIndex = 0) => page.evaluate(({ pieces, resultIndex }) => {
  globalThis.__speech.at(-1).onresult({ resultIndex, results: pieces.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) });
}, { pieces, resultIndex });
try {
  await page.goto(`${origin}/career/possibilities/interview`);
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  const answer = page.getByRole('textbox', { name: 'Your answer', exact: true });
  await answer.fill('Existing draft.');
  await page.getByRole('button', { name: 'Speak', exact: true }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await page.getByText('Starting microphone…', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Submit answer', exact: true }).isDisabled(), true);
  await page.evaluate(() => globalThis.__speech.at(-1).onstart());
  await page.getByText('Recording. Speak now.', { exact: true }).waitFor();
  await emit([['i checked', false], ['the total', false]]);
  await page.waitForFunction(() => document.querySelector('[aria-label="Your answer"]').value === 'Existing draft. I checked the total');
  await emit([['i checked', false], ['the totals', false]], 1);
  await page.waitForFunction(() => document.querySelector('[aria-label="Your answer"]').value === 'Existing draft. I checked the totals');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  assert.equal(await answer.inputValue(), 'Existing draft. I checked the totals.');
  assert.equal(await answer.getAttribute('readonly'), null);

  await page.getByRole('button', { name: 'Record again', exact: true }).click();
  await page.evaluate(() => globalThis.__speech.at(-1).onstart());
  await emit([['discard these words', false]]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await answer.inputValue(), 'Existing draft. I checked the totals.');
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await page.evaluate(() => { const recognition = globalThis.__speech.at(-1); recognition.onerror({ error: 'network' }); recognition.onend(); });
  await page.getByText('Voice typing is not working in this browser right now.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Type', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Speak', exact: true }).isDisabled(), true);
  assert.equal(await answer.inputValue(), 'Existing draft. I checked the totals.');
  assert.deepEqual(errors, []);
  console.log('Voice UI regression passed: readiness, partial updates, Stop, Cancel and service failure.');
} finally { await browser.close(); }
