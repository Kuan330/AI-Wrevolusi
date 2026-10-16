/** Cookie expiry and reauthentication QA with synthetic accounts and a local PDF renderer. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AIW_QA_ORIGIN || 'http://127.0.0.1:5187';
const renderer = process.env.AIW_QA_BACKEND || 'http://127.0.0.1:8017';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(renderer, /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || 'chrome' });
const page = await browser.newPage(); page.setDefaultTimeout(15000);
const owner = 'session-renewal-fixture', username = 'session_fixture';
const account = { id: owner, username };
const calls = [], errors = [];
let mode = 'healthy', refreshes = 0;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith('/api/v1/')) return route.continue();
  const path = url.pathname.slice('/api/v1'.length); calls.push(path);
  if (path === '/auth/refresh') {
    refreshes++;
    if (mode === 'invalid') return json(route, { detail: 'Refresh token expired.' }, 401);
    mode = 'healthy'; return json(route, {});
  }
  if (path === '/account/login') {
    assert.equal(request.postDataJSON().username, username);
    mode = 'healthy'; return json(route, account);
  }
  if (mode !== 'healthy') return json(route, { detail: 'Invalid access token.' }, 401);
  if (path === '/account/me') return json(route, account);
  if (path === '/account/workspace') return json(route, { owner_id: owner, data: {}, revision: 0 });
  if (path === '/reference/wef-skills') return json(route, []);
  if (path === '/learning/courses') return json(route, { found: true, courses: [] });
  if (path === '/learning/progress') return json(route, []);
  if (path === '/resume/capabilities') return json(route, { ai_configured: true, rendercv_version: '2.8' });
  if (path === '/resume/render') {
    const response = await route.fetch({ url: `${renderer}/api/v1/resume/render` });
    return route.fulfill({ response });
  }
  if (path === '/resume/assist') return json(route, {
    message: 'Updated project wording.', result_kind: 'edit', design: [],
    sections: [{ section_index: 1, entries: [{ entry: { name: 'Data Project', summary: 'Built clear reports.' }, source_ids: ['section-1-entry-0'] }] }],
  });
  return json(route, { detail: 'Offline fixture.' }, 503);
});

try {
  await page.goto(origin); await page.getByRole('button', { name: 'Account menu', exact: true }).waitFor();
  const document = { cv: { name: 'Synthetic User', sections: { Skills: [{ bullet: 'SQL' }], Projects: [{ name: 'Data Project', summary: 'Built reports.' }] } }, design: { theme: 'classic' } };
  const draft = { version: 1, owner, revision: 1, updatedAt: new Date().toISOString(), jobRequirements: 'Use SQL.', pendingJobRequirements: 'Use SQL.', document, previewDocument: null, yamlText: JSON.stringify(document), source: null, previous: null, proposal: null, gaps: [], recommendations: [] };
  await page.evaluate(draft => new Promise((resolve, reject) => {
    const request = indexedDB.open('aiwrevolusi.resume.local.v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts');
    request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put(draft, draft.owner); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), draft);
  await page.goto(`${origin}/career/possibilities/resume`);
  const skill = page.getByLabel('Bullet · Skills entry 1 bullet', { exact: true });
  const instruction = page.getByRole('textbox', { name: 'Ask AI to edit your resume' });
  await skill.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'PDF' && !button.disabled));

  await instruction.focus(); mode = 'expired';
  await page.getByRole('button', { name: 'Polish wording', exact: true }).click();
  await page.getByText('Changes applied', { exact: true }).waitFor();
  assert.equal(refreshes, 1); assert.equal(calls.filter(path => path === '/resume/assist').length, 2);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'PDF' && !button.disabled));

  // A failed renewal keeps the page, editor and unsent instruction mounted.
  await instruction.fill('Keep this unsent instruction'); mode = 'invalid';
  await skill.fill('SQL and Python');
  await page.getByRole('button', { name: 'Log in again', exact: true }).waitFor();
  assert.equal(refreshes, 2);
  const afterExpiry = calls.length;
  await skill.fill('SQL, Python and R');
  await page.waitForTimeout(1000);
  assert.equal(calls.length, afterExpiry, 'expired sessions do not hammer protected endpoints');
  assert.equal(await instruction.inputValue(), 'Keep this unsent instruction');
  assert.equal(new URL(page.url()).pathname, '/career/possibilities/resume');

  await page.getByRole('button', { name: 'Log in again', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.equal(await dialog.getByLabel(/^Username/).inputValue(), username);
  assert.equal(await dialog.getByLabel(/^Username/).getAttribute('readonly'), '');
  await dialog.getByLabel('Password', { exact: true }).fill('SyntheticPassword123!');
  await dialog.getByRole('button', { name: 'Log in', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: 'Log in again', exact: true }).count(), 0);
  assert.equal(await skill.inputValue(), 'SQL, Python and R');
  assert.equal(await instruction.inputValue(), 'Keep this unsent instruction');
  assert.equal(new URL(page.url()).pathname, '/career/possibilities/resume');
  await skill.fill('SQL, Python, R and Java');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'PDF' && !button.disabled));
  assert.equal(refreshes, 2); assert.deepEqual(errors, []);
  console.log('PASS: real assistant 401 renewal/replay, PDF renewal failure, no repeated unauthorized requests, same-page reauthentication, unsent instruction/editor preservation and resumed PDF rendering.');
} catch (error) {
  console.error({ calls, errors, body: await page.locator('body').innerText() });
  throw error;
} finally { await browser.close(); }
