/** Offline regression: saved Resume Builder sections need no separate review mark. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyDraft } from '../src/features/resume/types.ts';
import { targetRequirements } from '../src/features/resume/targetRole.ts';

const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AIW_QA_ORIGIN || 'http://127.0.0.1:5189';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const owner = 'qa-interview-resume';
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || 'chrome' });
const context = await browser.newContext();
const output = process.env.AIW_QA_OUTPUT;
if (output) { await mkdir(output, { recursive: true }); await context.tracing.start({ screenshots: true, snapshots: true }); }
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], plans = [], banks = [];
let workspace = {};
page.on('pageerror', error => errors.push(error.message));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const path = url.pathname.replace('/api/v1', '');
  if (path === '/account/me') return json(route, { id: owner, email: 'test@example.test', full_name: 'Test account' });
  if (path === '/account/workspace') return json(route, { owner_id: owner, data: workspace, revision: 0 });
  if (path === '/interview/question-bank') {
    const code = url.searchParams.get('occupation_code'); banks.push(code);
    return json(route, { occupation_code: code, matched: 'common', questions: [] });
  }
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
const readDraft = () => page.evaluate(owner => new Promise((resolve, reject) => {
  const request = indexedDB.open('aiwrevolusi.resume.local.v1', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction('drafts', 'readonly');
    const read = tx.objectStore('drafts').get(owner);
    tx.oncomplete = () => { db.close(); resolve(read.result); };
  };
}), owner);
const openResume = async () => {
  await page.goto(`${origin}/career/possibilities/interview`);
  await page.getByRole('radio', { name: /My resume/ }).check();
  await page.getByText('Loading your resume…').waitFor({ state: 'hidden' });
};
const start = page.getByRole('button', { name: 'Start practice', exact: true });
const consent = page.getByRole('checkbox', { name: 'I checked this and want to send it to AI.' });
try {
  await page.goto(`${origin}/`);
  const homeInterview = page.locator('.home-career-ready').getByRole('link', { name: 'Practise for an interview' });
  await homeInterview.scrollIntoViewIfNeeded();
  assert.equal(await homeInterview.getAttribute('href'), '/career/possibilities/interview');
  assert.notEqual(await homeInterview.getAttribute('aria-disabled'), 'true');
  if (output) await page.locator('.home-career-ready').screenshot({ path: `${output}/home-interview-link.png` });
  await homeInterview.click(); await page.waitForURL(`${origin}/career/possibilities/interview`);
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

  const target = { occupation_code: '2421', title: 'Management and Organization Analysts', skills: [{ skill_id: 1, skill_slug: 'analytical-thinking', name: 'Analytical thinking' }] };
  const preserved = { ...draft, jobRequirements: '', pendingJobRequirements: targetRequirements(target), targetRole: target,
    generationOutcome: 'source_preserved', generationNotices: ['ai_timeout'], generationInputFingerprint: 'preserved-input' };
  workspace = { 'aiwrevolusi.possibilities.chosenDirection': JSON.stringify(target) };
  await writeDraft(preserved); await openResume(); await consent.waitFor();
  await page.locator('.ip-facts').getByText(target.title, { exact: true }).waitFor();
  await page.getByText('Practice uses your selected target role. This resume has not been tailored to that role.', { exact: true }).waitFor();
  assert.equal(await start.isDisabled(), true, 'A preserved resume still needs privacy consent');
  assert.equal(plans.length, 2, 'Opening the saved resume never sends it to AI');
  await page.getByText('What AI will receive', { exact: true }).click();
  await page.getByLabel('Extra private words to hide (one per line)').fill('Example Company');
  const preview = JSON.parse(await page.getByRole('textbox', { name: 'What AI will receive', exact: true }).inputValue());
  assert.equal(preview.role, target.title);
  assert.doesNotMatch(JSON.stringify(preview), /Private Person|private@example.test|Example Company/);
  if (output) await page.screenshot({ path: `${output}/preserved-resume-consent.png`, fullPage: true });
  await consent.check(); assert.equal(await start.isEnabled(), true);
  if (output) await page.screenshot({ path: `${output}/preserved-resume-ready.png`, fullPage: true });
  await start.click();
  await page.getByText(/Based on your resume saved on/).waitFor();
  assert.equal(plans[2].role_title, target.title);
  assert.equal(plans[2].items_reviewed, true);
  assert.doesNotMatch(JSON.stringify(plans[2]), /Private Person|private@example.test|Example Company/);
  assert.equal(banks.at(-1), target.occupation_code);
  assert.deepEqual(await readDraft(), preserved, 'Starting practice does not mark a preserved resume as tailored');
  if (output) await page.screenshot({ path: `${output}/preserved-resume-session.png`, fullPage: true });

  const nextTarget = { ...target, occupation_code: '2512', title: 'Software developers' };
  workspace = { 'aiwrevolusi.possibilities.chosenDirection': JSON.stringify(nextTarget) };
  const changedTarget = { ...preserved, targetRole: nextTarget, pendingJobRequirements: targetRequirements(nextTarget) };
  await writeDraft(changedTarget); await openResume(); await consent.waitFor();
  await page.locator('.ip-facts').getByText(nextTarget.title, { exact: true }).waitFor();
  assert.equal(await start.isDisabled(), true, 'Changing the practice target does not carry consent forward');
  await consent.check(); await start.click(); await page.getByText(/Based on your resume saved on/).waitFor();
  assert.equal(plans[3].role_title, nextTarget.title);
  assert.equal(banks.at(-1), nextTarget.occupation_code);
  assert.deepEqual(await readDraft(), changedTarget);

  const legacy = { ...draft, targetRole: nextTarget, pendingJobRequirements: targetRequirements(nextTarget) };
  await writeDraft(legacy); await openResume(); await consent.waitFor();
  await page.locator('.ip-facts').getByText('Analyst', { exact: true }).waitFor();
  assert.equal(await page.getByText('Practice uses your selected target role.', { exact: false }).count(), 0);
  await consent.check(); await start.click(); await page.getByText(/Based on your resume saved on/).waitFor();
  assert.equal(plans[4].role_title, 'Analyst', 'Legacy applied role stays with its saved resume');
  assert.equal(banks.at(-1), '0000', 'A different future target must not supply the saved resume question bank');
  assert.deepEqual(await readDraft(), legacy);
  workspace = {};

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
  if (output) await writeFile(`${output}/interview-receipts.json`, JSON.stringify({ plans, banks, errors }, null, 2));
  console.log('Saved resume flow passed: Home interview link, preserved fallback target, consent and redaction, unchanged tailoring evidence, target changes, legacy applied role, saved edits, old snapshots, missing content and builder link.');
} finally {
  if (output) await context.tracing.stop({ path: `${output}/trace.zip` });
  await browser.close();
}
