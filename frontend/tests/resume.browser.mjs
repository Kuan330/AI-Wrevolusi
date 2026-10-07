/** Isolated QA: synthetic accounts/AI/courses; only PDFs use a local real engine.
 * Requires Vite on 5186, tests.resume_preview_server on 8016 and Playwright.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { docxFixture, blankPdf } from './resume-fixtures.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AIW_QA_ORIGIN || 'http://127.0.0.1:5186', renderer = 'http://127.0.0.1:8016';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const output = fileURLToPath(new URL('../../.local/resume-qa', import.meta.url)); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || "chrome" });
const context = await browser.newContext({ viewport: { width: 1536, height: 1000 }, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = [], sync = []; page.on('pageerror', e => errors.push(e.message));
let owner = 'qa-account-a', signedIn = true, count = 0, fail = false, lastPdf, latestInput;
const base = { 'aiwrevolusi.learningSkills.v1': JSON.stringify([{ id: 'analytical-thinking', name: 'Analytical thinking' }, { id: 'sql', name: 'SQL' }]) };
let workspace = { ...base };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const path = url.pathname.replace('/api/v1', '');
  if (path === '/account/me') return json(route, signedIn ? { id: owner, email: 'synthetic@example.test', full_name: 'Synthetic account' } : { detail: 'Unauthenticated' }, signedIn ? 200 : 401);
  if (path === '/account/workspace') {
    if (req.method() === 'PATCH') { const body = req.postDataJSON(); sync.push(body); workspace = body.data; return json(route, { owner_id: owner, data: workspace, revision: body.revision + 1 }); }
    return json(route, { owner_id: owner, data: workspace, revision: 0 });
  }
  if (path === '/auth/logout') { signedIn = false; return json(route, null); }
  if (path === '/auth/refresh') return json(route, { detail: 'Unauthenticated' }, 401);
  if (path === '/reference/wef-skills') return json(route, [{ wef_skill_id: 1, core_skill: 'Analytical thinking' }]);
  if (path === '/resume/capabilities') return json(route, { ai_configured: true, ai_provider_host: 'synthetic.provider.test', ai_model: 'fixture-only', rendercv_version: '2.8' });
  if (path === '/resume/generate') {
    const input = req.postDataJSON(); latestInput = input; count++; assert.ok(input.job_requirements.trim()); assert.ok(!input.contacts && !input.name);
    assert.ok(!JSON.stringify(input).includes('alex@example.com'));
    if (fail) { fail = false; return json(route, { detail: 'Synthetic retryable error' }, 503); }
    const s = input.skills[0];
    return json(route, { sections: [{ title: 'Skills', entries: [{ text: s.name + (count > 2 ? ' applied to analysis' : ''), skill_ids: [s.id], fact_ids: [] }] }], gaps: [{ id: 'security', label: 'Cybersecurity', keywords: ['security'], skill_slugs: ['networks-and-cybersecurity'] }] });
  }
  if (path === '/resume/recommend-courses') return json(route, { courses: ['security-1', 'security-2'].map(course_id => ({ course_id, gap_ids: ['security'], reason: 'Addresses the specified cybersecurity gap.' })) });
  if (path === '/learning/courses') return json(route, { found: true, courses: ['security-1', 'security-2'].map((course_id, i) => ({ course_id, skill_id: 'networks-and-cybersecurity', title: `Security course ${i + 1}`, provider: 'Synthetic catalogue', level: 'Beginner', chapters: [{ order: 1, title: 'Security foundations', duration_min: 30 }], chapter_count: 1 })) });
  if (path === '/resume/render') { const response = await route.fetch({ url: `${renderer}/api/v1/resume/render` }); if (response.status() === 200) lastPdf = await response.body(); return route.fulfill({ response }); }
  return json(route, { detail: 'Deliberately unavailable in offline QA' }, 503);
});
const ready = () => page.getByRole('heading', { name: 'Make your next move.' }).waitFor();
const saved = () => page.getByText('Saved on this device', { exact: true }).waitFor();
const pdfReady = async () => { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'PDF' && !b.disabled)); await page.locator('.rb-preview canvas').waitFor({ state: 'attached' }); };
const exportFile = async name => { const pending = page.waitForEvent('download'); await page.getByRole('button', { name, exact: true }).click(); return readFile(await (await pending).path()); };
try {
  await page.goto(`${origin}/career/possibilities/resume`); await ready();
  const job = page.getByLabel(/Target job requirements · required/);
  assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true);
  await job.fill('QA TARGET PRIVATE: analyse data using SQL and cybersecurity.'); await saved();
  await page.reload(); await ready(); assert.match(await job.inputValue(), /QA TARGET PRIVATE/);
  fail = true; await page.getByRole('button', { name: 'Generate my resume' }).click(); await page.getByRole('alert').filter({ hasText: 'Synthetic retryable' }).waitFor();
  assert.match(await job.inputValue(), /QA TARGET PRIVATE/); await page.getByRole('button', { name: 'Generate my resume' }).click(); await pdfReady(); await saved();
  const yaml = (await exportFile('YAML')).toString(); assert.match(yaml, /Skills:/); assert.doesNotMatch(yaml, /name:|Experience:|Education:/);
  const pdf = await exportFile('PDF'); await writeFile(`${output}/synthetic.pdf`, pdf); assert.ok(pdf.equals(lastPdf), 'Preview/download bytes must match');
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  const courses = page.locator('.rb-courses'); await courses.waitFor();
  await courses.locator('.rb-course').first().getByRole('checkbox').check(); await courses.getByRole('button', { name: /Add selected/ }).click();
  await courses.getByText('Added to My courses.', { exact: false }).waitFor(); assert.equal(await courses.locator('.rb-added').count(), 1);
  await courses.getByRole('checkbox', { name: /Select all/ }).check(); await courses.getByRole('button', { name: /Add selected/ }).click(); await page.waitForFunction(() => document.querySelectorAll('.rb-added').length === 2);
  await page.getByRole('tab', { name: 'YAML', exact: true }).click(); const editor = page.locator('.cm-content');
  await editor.fill('cv: {}\nunknown: preserve-this-value'); await saved();
  assert.match((await exportFile('YAML')).toString(), /preserve-this-value/); assert.equal(await page.getByRole('button', { name: 'PDF', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('img', { name: /Resume PDF/ }).count(), 1);
  await page.reload(); await ready(); await page.locator('.rb-preview canvas').waitFor({ state: 'attached' });
  assert.equal(await page.getByRole('button', { name: 'PDF', exact: true }).isDisabled(), true);
  assert.match((await exportFile('YAML')).toString(), /preserve-this-value/);
  await page.getByRole('tab', { name: 'YAML', exact: true }).click();
  await editor.fill(yaml); await page.getByRole('tab', { name: 'Form editor' }).click(); await pdfReady();
  await page.getByRole('button', { name: /Add section/ }).click(); await page.getByLabel('Chapter title').fill('Projects'); await page.getByRole('dialog').getByRole('button', { name: 'Add chapter', exact: true }).click();
  await page.getByRole('button', { name: 'Add entry', exact: true }).click(); await page.getByLabel(/^Bullet/).fill('User-entered factual project.'); await saved();
  await page.getByRole('button', { name: 'Target & AI' }).click(); await page.getByRole('button', { name: 'Generate new suggestions' }).click();
  const dialog = page.getByRole('dialog', { name: 'Review AI suggestions' }); await dialog.waitFor(); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Apply selected chapters' }).click(); await saved();
  assert.match((await exportFile('YAML')).toString(), /User-entered factual project/); await page.getByRole('button', { name: 'Undo AI changes' }).click(); await saved(); assert.match((await exportFile('YAML')).toString(), /User-entered factual project/);
  if (!await page.locator('.rb-job-card').isVisible()) await page.getByRole('button', { name: 'Target & AI' }).click(); await page.locator('input[type=file]').setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel(/Resume evidence that AI will receive/).waitFor(); assert.ok((await page.getByLabel(/Resume evidence that AI will receive/).inputValue()).length > 3);
  assert.equal(await page.getByRole('button', { name: 'Generate new suggestions' }).isDisabled(), true); await page.getByRole('button', { name: 'Remove source' }).click(); await page.getByRole('button', { name: 'Back to editing' }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('tab', { name: 'PDF preview', exact: true }).click(); await page.getByRole('img', { name: /Resume PDF/ }).waitFor(); assert.equal(await page.locator('.rb-editor').isVisible(), false);
  await page.screenshot({ path: `${output}/mobile-preview.png`, fullPage: true }); await page.getByRole('tab', { name: 'Edit resume', exact: true }).click(); await page.getByRole('tab', { name: 'Form editor' }).focus(); await page.keyboard.press('ArrowRight'); await editor.waitFor(); await page.screenshot({ path: `${output}/mobile-edit.png`, fullPage: true });
  const multi = 'cv:\n  sections:\n    Skills:\n' + Array.from({ length: 30 }, () => '      - bullet: "' + 'Analytical thinking. '.repeat(20) + '"\n').join('') + 'design:\n  theme: classic\n';
  await editor.fill(multi); await saved(); await pdfReady(); await page.getByRole('tab', { name: 'PDF preview', exact: true }).click(); await page.getByRole('button', { name: 'Next PDF page' }).click(); await page.getByRole('img', { name: /page 2 of/ }).waitFor(); await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.reload(); await ready(); await page.getByRole('tab', { name: 'PDF preview', exact: true }).click(); await pdfReady();
  owner = 'qa-account-b'; workspace = { ...base }; await page.reload(); await ready(); assert.equal(await job.inputValue(), ''); assert.equal(await page.getByRole('img', { name: /Resume PDF/ }).count(), 0);
  owner = 'qa-account-a'; workspace = { ...base }; await page.reload(); await ready(); await pdfReady();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click(); await page.getByRole('button', { name: /Log out/ }).click(); await page.waitForURL(`${origin}/`); assert.equal(await page.getByRole('img', { name: /Resume PDF/ }).count(), 0);
  signedIn = true; await page.goto(`${origin}/career/possibilities/resume`); await ready(); await pdfReady();
  await page.getByRole('button', { name: 'Clear local resume data' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear local resume', exact: true }).click(); await job.waitFor(); assert.equal(await job.inputValue(), '');
  // Invalid sources never overwrite the locally restored resume.
  for (const [name, buffer, error] of [
    ['large.pdf', Buffer.alloc(10 * 1024 * 1024 + 1), /at most 10 MB/],
    ['broken.pdf', Buffer.from('broken'), /could not be read/],
    ['blank.pdf', blankPdf(), /No readable text/],
    ['broken.docx', Buffer.from('broken'), /damaged|could not be read/],
    ['encrypted.docx', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...Array(16).fill(0)]), /encrypted|old Word/],
    ['blank.docx', docxFixture(['']), /No readable text/],
  ]) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType: name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
    await page.getByRole('alert').filter({ hasText: error }).waitFor();
    assert.equal(await page.locator('.rb-source-review').count(), 0);
  }
  if (process.env.AIW_QA_ENCRYPTED_PDF) {
    await page.locator('input[type=file]').setInputFiles({ name: 'encrypted.pdf', mimeType: 'application/pdf', buffer: await readFile(process.env.AIW_QA_ENCRYPTED_PDF) });
    await page.getByRole('alert').filter({ hasText: /encrypted/ }).waitFor();
  }
  // Original My Plan control retains unsubmitted form selections and uses only IDB.
  await page.goto(`${origin}/learning/plan`);
  const planFile = page.locator('input[type=file]'); await planFile.waitFor({ state: 'attached' });
  await page.getByText('New to it', { exact: true }).click();
  const source = docxFixture(['Alex Example', 'alex@example.com', '+61 412 345 678', 'Skills', 'SQL, Python', 'Experience', 'Built 12 reports for Acme in 2022.']);
  await planFile.setInputFiles({ name: 'source.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: source });
  await page.getByText('source.docx saved locally', { exact: false }).waitFor();
  assert.match(page.url(), /learning\/plan$/); assert.equal(await page.locator('input[type=radio]').first().isChecked(), true);
  assert.equal(await page.getByRole('list', { name: 'Attached references' }).count(), 0);
  await page.getByRole('link', { name: /Open Resume builder/ }).click(); await ready();
  assert.equal(await job.inputValue(), ''); assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true);
  await page.getByLabel(/Resume evidence that AI will receive/).waitFor();
  assert.doesNotMatch(await page.getByLabel(/Resume evidence that AI will receive/).inputValue(), /Alex Example|alex@example|412 345/);
  await job.fill('QA TARGET PRIVATE: analysis and Python.'); await page.locator('.rb-source-review .rb-check').getByRole('checkbox').check();
  await page.locator('.rb-skill-chips').getByText('Python', { exact: true }).waitFor(); await saved();
  await page.getByRole('button', { name: 'Generate my resume' }).click(); await pdfReady();
  assert.ok(latestInput.skills.some(skill => skill.name === 'Python')); assert.doesNotMatch(JSON.stringify(latestInput), /Alex Example|alex@example.com|412 345/);
  assert.ok(sync.every(payload => !JSON.stringify(payload).includes('QA TARGET PRIVATE') && !Object.keys(payload.data).some(key => key.includes('resume')))); assert.deepEqual(errors, []);
  console.log('PASS: first-use/retry/recovery, same PDF export, course partial/all, YAML recovery, section apply/undo, PDF import, desktop/mobile/keyboard, pagination/zoom, account isolation/logout/clear, no resume sync, invalid/encrypted/textless sources, DOCX/My Plan handoff and original-skill review.');
} catch (error) { console.error(errors, await page.locator("body").innerText()); await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); throw error; } finally { await context.close(); await browser.close(); }
