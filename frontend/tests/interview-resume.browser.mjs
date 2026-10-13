/** Offline regression: saved Resume Builder sections need no separate review mark. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { emptyDraft } from '../src/features/resume/types.ts';

const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AIW_QA_ORIGIN || 'http://127.0.0.1:5189';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const owner = 'qa-interview-resume';
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || 'chrome' });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], plans = [];
page.on('pageerror', error => errors.push(error.message));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const path = url.pathname.replace('/api/v1', '');
  if (path === '/account/me') return json(route, { id: owner, email: 'test@example.test', full_name: 'Test account' });
  if (path === '/account/workspace') return json(route, { owner_id: owner, data: {}, revision: 0 });
  if (path === '/interview/question-bank') return json(route, { occupation_code: '0000', matched: 'common', questions: [] });
  if (path === '/interview/plan') {
    const body = request.postDataJSON(); plans.push(body);
    const item = body.items.find(item => item.kind === 'work');
    return json(route, { source: 'template', questions: [{ text: 'Tell me about this experience.', kind: 'resume_item', item_id: item.id, topic_id: null, bank_id: null }] });
  }
  if (path === '/reference/wef-skills') return json(route, []);
  if (path === '/resume/capabilities') return json(route, { ai_configured: false, render_available: false });
  return json(route, { detail: 'Unavailable in offline QA' }, 503);
});
const draft = { ...emptyDraft(owner), revision: 1, updatedAt: '2026-10-13T12:00:00.000Z', jobRequirements: 'Analyst\nPrepare reports.',
  document: { cv: { name: 'Private Person', email: 'private@example.test', sections: {
    Summary: ['Analyst who prepares reports.'], Experience: [{ position: 'Analyst', company: 'Example Company', highlights: ['Built the first report.'] }],
    Projects: [{ name: 'Report tracker', highlights: ['Tracked changes.'] }], Skills: ['Excel'],
  } } } };
const writeDraft = value => page.evaluate(({ owner, value }) => new Promise((resolve, reject) => {
  const request = indexedDB.open('aiwrevolusi.resume.local.v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction('drafts', 'readwrite');
    tx.objectStore('drafts').put(value, owner);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = tx.onerror = () => reject(tx.error);
  };
}), { owner, value });
const openResume = async () => {
  await page.goto(`${origin}/career/possibilities/interview`);
  await page.getByRole('radio', { name: /My resume/ }).check();
  await page.getByText('Loading your resume…').waitFor({ state: 'hidden' });
};
const start = page.getByRole('button', { name: 'Start practice', exact: true });
const consent = page.getByRole('checkbox', { name: 'I checked this and want to send it to AI.' });
try {
  await page.goto(`${origin}/career/possibilities/interview`);
  await page.getByRole('radio', { name: /My resume/ }).waitFor();
  await writeDraft(draft);
  await openResume();
  await consent.waitFor();
  assert.equal(await start.isDisabled(), true, 'Sending resume details still needs consent');
  assert.equal(plans.length, 0);
  assert.doesNotMatch(await page.locator('.ip-resume').textContent(), /review again|Changed since|No resume yet/);
  await consent.check(); await start.click();
  await page.getByText(/Based on your resume saved on/).waitFor();
  assert.deepEqual(plans[0].items.map(item => item.kind), ['summary', 'work', 'project', 'skill', 'requirement']);
  assert.ok(plans[0].items.some(item => item.text.includes('Built the first report.')));
  assert.equal(plans[0].items_reviewed, true);
  assert.doesNotMatch(JSON.stringify(plans[0]), /Private Person|private@example.test/);

  const edited = structuredClone(draft);
  edited.revision = 2; edited.updatedAt = '2026-10-13T12:30:00.000Z';
  edited.reviewed = { at: '2026-10-07T00:00:00.000Z', fingerprint: 'stale-review-mark' };
  edited.document.cv.sections.Experience[0].highlights = ['Built the updated report.'];
  await writeDraft(edited); await openResume();
  await consent.check(); await start.click();
  await page.getByText(/Based on your resume saved on/).waitFor();
  assert.ok(plans[1].items.some(item => item.text.includes('Built the updated report.')));
  assert.ok(!plans[1].items.some(item => item.text.includes('Built the first report.')));
  const sessions = await page.evaluate(owner => new Promise(resolve => {
    const request = indexedDB.open('aiwrevolusi.interview.local.v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('sessions', 'readonly');
      const read = tx.objectStore('sessions').get(owner);
      tx.oncomplete = () => { db.close(); resolve(read.result.sessions); };
    };
  }), owner);
  assert.equal(sessions.length, 2);
  assert.ok(sessions.some(session => session.items.some(item => item.text.includes('Built the first report.'))), 'Old practice keeps its original resume');

  await writeDraft({ ...draft, document: { cv: { sections: {} } } }); await openResume();
  await page.getByText(/Add experience, projects, skills or a summary/).waitFor();
  assert.equal(await start.isDisabled(), true);
  await writeDraft({ ...draft, jobRequirements: '' }); await openResume();
  await page.getByText(/Add a target role in Resume Builder/).waitFor();
  assert.equal(await start.isDisabled(), true);
  await writeDraft({ ...draft, document: null }); await openResume();
  await page.getByText('No resume yet', { exact: true }).waitFor();
  assert.equal(await start.isDisabled(), true);

  await writeDraft(edited);
  await page.goto(`${origin}/career/possibilities/resume`);
  await page.locator('.rw-review-line').waitFor();
  assert.equal(await page.getByRole('button', { name: 'I reviewed this resume' }).count(), 0);
  await page.locator('.rw-review-line').getByRole('link', { name: 'Practise for an interview' }).click();
  await consent.waitFor({ state: 'hidden' });
  await page.getByRole('radio', { name: /My resume/ }).check();
  await consent.waitFor();
  assert.equal(await start.isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('Saved resume flow passed: no review mark, saved edits, privacy consent, old snapshots, missing content and builder link.');
} finally { await browser.close(); }
