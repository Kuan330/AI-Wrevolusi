/** Isolated QA: synthetic accounts/AI/courses; only PDFs use a local real engine.
 * Requires Vite on 5186, tests.resume_preview_server on 8016 and Playwright.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { docxFixture, blankPdf } from './resume-fixtures.mjs';
import { EXAMPLE_JOB_REQUIREMENTS } from '../src/features/resume/onboarding.ts';
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
let owner = 'qa-account-empty', signedIn = true, count = 0, courseRequests = 0, aiConfigured = false, fail = false, lastPdf, latestInput;
let releaseSkillLoad, generateGate = null;
let skillGate = new Promise(resolve => { releaseSkillLoad = resolve; });
const base = { 'aiwrevolusi.learningSkills.v1': JSON.stringify([{ id: 'analytical-thinking', name: 'Analytical thinking' }, { id: 'sql', name: 'SQL' }]) };
let workspace = {};
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
  if (path === '/reference/wef-skills') { if (skillGate) await skillGate; return json(route, [{ wef_skill_id: 1, core_skill: 'Analytical thinking' }]); }
  if (path === '/resume/capabilities') return json(route, { ai_configured: aiConfigured, ai_provider_host: 'synthetic.provider.test', ai_model: 'fixture-only', rendercv_version: '2.8' });
  if (path === '/resume/generate') {
    const input = req.postDataJSON(); latestInput = input; count++; assert.ok(input.job_requirements.trim()); assert.ok(!input.contacts && !input.name);
    assert.ok(!JSON.stringify(input).includes('alex@example.com'));
    if (generateGate) await generateGate;
    if (fail) { fail = false; return json(route, { detail: 'Synthetic retryable error' }, 503); }
    const s = input.skills[0];
    return json(route, { sections: [{ title: 'Skills', entries: [{ text: s.name + (count > 2 ? ' applied to analysis' : ''), skill_ids: [s.id], fact_ids: [] }] }], gaps: [{ id: 'security', label: 'Cybersecurity', keywords: ['security'], skill_slugs: ['networks-and-cybersecurity'] }] });
  }
  if (path === '/resume/recommend-courses') { courseRequests++; return json(route, { courses: ['security-1', 'security-2'].map(course_id => ({ course_id, gap_ids: ['security'], reason: 'Addresses the specified cybersecurity gap.' })) }); }
  if (path === '/learning/courses') return json(route, { found: true, courses: ['security-1', 'security-2'].map((course_id, i) => ({ course_id, skill_id: 'networks-and-cybersecurity', title: `Security course ${i + 1}`, provider: 'Synthetic catalogue', level: 'Beginner', chapters: [{ order: 1, title: 'Security foundations', duration_min: 30 }], chapter_count: 1 })) });
  if (path === '/resume/render') { const response = await route.fetch({ url: `${renderer}/api/v1/resume/render` }); if (response.status() === 200) lastPdf = await response.body(); return route.fulfill({ response }); }
  return json(route, { detail: 'Deliberately unavailable in offline QA' }, 503);
});
const ready = () => page.waitForFunction(() => document.querySelector('.rw-workbench') || document.querySelector('.rb-job-card'));
const saved = () => page.getByText('Saved on this device', { exact: true }).waitFor();
const pdfReady = async () => { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'PDF' && !b.disabled)); if (await page.locator('.rw-preview-pane').isVisible()) await page.locator('.rw-pdf-page canvas').first().waitFor({ state: 'attached' }); };
const exportFile = async name => {
  let menu = false;
  if (name === 'YAML' && !await page.getByRole('button', { name: 'Download YAML', exact: true }).isVisible()) { await page.getByRole('button', { name: 'Resume options' }).click(); menu = true; }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: name === 'YAML' ? 'Download YAML' : name, exact: true }).click();
  const bytes = await readFile(await (await pending).path());
  if (menu) await page.getByRole('dialog', { name: 'Resume options' }).getByRole('button', { name: 'Close', exact: true }).click();
  return bytes;
};
try {
  await page.goto(`${origin}/career/possibilities/resume`); await ready();
  const job = page.getByLabel(/Target job requirements · required/);
  assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true);
  // First-use shortcut: keyboard activation, replacement consent and local persistence.
  const example = page.getByRole('button', { name: 'Use an example', exact: true });
  await example.focus(); await page.keyboard.press('Enter');
  assert.equal(await job.inputValue(), EXAMPLE_JOB_REQUIREMENTS);
  assert.equal(count, 0); assert.equal(courseRequests, 0);
  assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true, 'Pending skill loading is not zero skills');
  releaseSkillLoad(); skillGate = null;
  await job.fill('My own requirements'); await example.click();
  const replacement = page.getByRole('dialog', { name: 'Replace your job requirements?' }); await replacement.waitFor();
  await replacement.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(await job.inputValue(), 'My own requirements');
  await example.click(); await replacement.getByRole('button', { name: 'Use example', exact: true }).click();
  assert.equal(await job.inputValue(), EXAMPLE_JOB_REQUIREMENTS);
  const editedExample = EXAMPLE_JOB_REQUIREMENTS + '\nUser-edited requirements.';
  await job.fill(editedExample); await saved(); await page.reload(); await ready(); assert.equal(await job.inputValue(), editedExample);
  assert.equal(await page.getByRole('button', { name: 'Privacy details' }).getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Privacy details' }).click(); await page.getByText(/zero retention is not guaranteed/).waitFor();
  assert.doesNotMatch(await page.locator('body').textContent(), /synthetic.provider.test|fixture-only|available skills|20,000 characters/);
  await page.getByRole('button', { name: 'Privacy details' }).click();
  await page.getByText(/zero retention is not guaranteed/).waitFor({ state: 'hidden' });
  await page.screenshot({ path: `${output}/first-use-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const textareaBox = await job.boundingBox(), exampleBox = await example.boundingBox();
  assert.ok(exampleBox.x + exampleBox.width <= textareaBox.x + textareaBox.width + 2);
  assert.ok(exampleBox.x > textareaBox.x + textareaBox.width / 2);
  await page.screenshot({ path: `${output}/first-use-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1536, height: 1000 });
  // Even a manually supplied, unreviewed source still requires consent/removal.
  await page.getByRole('button', { name: 'Or enter your resume details manually' }).click();
  assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Remove source' }).click();
  await page.getByRole('button', { name: 'Generate my resume' }).click(); await pdfReady(); await saved();
  assert.equal(count, 0, 'Empty drafts must not call AI'); assert.equal(courseRequests, 0, 'Empty drafts must not request courses');
  const emptyYaml = (await exportFile('YAML')).toString(); assert.match(emptyYaml, /Skills: \[\]/); assert.doesNotMatch(emptyYaml, /name:|Experience:|Education:/);
  assert.ok((await exportFile('PDF')).equals(lastPdf)); assert.equal(await example.count(), 0);
  await page.getByText('No skills yet. Add your skills to this draft.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add entry · Skills', exact: true }).click(); await page.getByLabel(/^Bullet/).fill('User-entered analytical thinking');
  await saved(); await page.reload(); await ready(); await pdfReady(); assert.match((await exportFile('YAML')).toString(), /User-entered analytical thinking/);
  await page.getByRole('button', { name: 'Target & AI' }).click();
  assert.equal(await page.getByRole('button', { name: 'Generate new suggestions' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Back to editing' }).click();
  assert.match((await exportFile('YAML')).toString(), /User-entered analytical thinking/);
  // Unreadable skill storage is an error, not an empty-skill fallback; retry remains available.
  owner = 'qa-account-unreadable'; workspace = { ...base, 'aiwrevolusi.learningSkills.v1': '{broken-json' };
  await page.reload(); await ready(); await job.fill('QA SKILL ERROR: analyse data.'); await saved();
  await page.getByRole('alert').filter({ hasText: "We couldn't load your saved skills" }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Retry skills' }).click();
  assert.equal(await page.getByRole('button', { name: 'Generate my resume' }).isDisabled(), true);
  workspace = {}; await page.reload(); await ready(); assert.equal(await job.inputValue(), 'QA SKILL ERROR: analyse data.');
  await page.getByRole('button', { name: 'Generate my resume' }).click(); await pdfReady(); assert.equal(count, 0);
  // The existing complete regression continues using an account with real saved skill candidates.
  owner = 'qa-account-a'; workspace = { ...base }; aiConfigured = true; await page.reload(); await ready();
  assert.equal(await job.inputValue(), '');
  await job.fill('QA TARGET PRIVATE: analyse data using SQL and cybersecurity.'); await saved();
  await page.reload(); await ready(); assert.match(await job.inputValue(), /QA TARGET PRIVATE/);
  fail = true; let releaseGenerate; generateGate = new Promise(resolve => { releaseGenerate = resolve; });
  await page.getByRole('button', { name: 'Generate my resume' }).click();
  assert.equal(await example.isDisabled(), true); releaseGenerate(); generateGate = null;
  await page.getByRole('alert').filter({ hasText: 'Synthetic retryable' }).waitFor();
  assert.match(await job.inputValue(), /QA TARGET PRIVATE/); await page.getByRole('button', { name: 'Generate my resume' }).click(); await pdfReady(); await saved();
  const yaml = (await exportFile('YAML')).toString(); assert.match(yaml, /Skills:/); assert.doesNotMatch(yaml, /name:|Experience:|Education:/);
  const pdf = await exportFile('PDF'); await writeFile(`${output}/synthetic.pdf`, pdf); assert.ok(pdf.equals(lastPdf), 'Preview/download bytes must match');
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  assert.ok(await page.locator('.workspace-editor-focus').count(), 'Editor uses isolated focus mode');
  const navPreference = await page.evaluate(() => localStorage.getItem('aiwrevolusi.sidebar.collapsed'));
  await page.getByRole('button', { name: 'Open workspace menu' }).click();
  await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => localStorage.getItem('aiwrevolusi.sidebar.collapsed')), navPreference);
  const separator = page.getByRole('separator', { name: 'Resize editor and preview' });
  assert.equal(await separator.getAttribute('aria-valuenow'), '50'); await separator.focus(); await page.keyboard.press('ArrowLeft'); assert.equal(await separator.getAttribute('aria-valuenow'), '48'); await page.keyboard.press('Home');
  const bounds = await separator.boundingBox(); await page.mouse.move(bounds.x + 3, bounds.y + 100); await page.mouse.down(); await page.mouse.move(bounds.x + 100, bounds.y + 100); await page.mouse.up(); assert.ok(Number(await separator.getAttribute('aria-valuenow')) > 50); await separator.focus(); await page.keyboard.press('Home');
  for (const tab of ['Design', 'Locale', 'Settings', 'CV']) { await page.getByRole('tab', { name: tab, exact: true }).click(); assert.equal((await exportFile('YAML')).toString(), yaml, 'Opening tabs must not materialize defaults'); }
  await page.getByRole('button', { name: 'Collapse all sections' }).click(); assert.equal(await page.getByLabel('Bullet · Skills entry 1 bullet').count(), 0); await page.getByRole('button', { name: 'Expand all sections' }).click();
  const skillField = page.getByLabel('Bullet · Skills entry 1 bullet'); await skillField.focus(); await skillField.press("ControlOrMeta+A");
  assert.equal(await page.getByRole('button', { name: 'Bold selection' }).isDisabled(), false); await page.getByRole('button', { name: 'Bold selection' }).click(); await saved(); assert.match((await exportFile('YAML')).toString(), /\*\*/);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal((await exportFile('YAML')).toString(), yaml); await page.getByRole('button', { name: 'Redo', exact: true }).click(); assert.match((await exportFile('YAML')).toString(), /\*\*/); await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await skillField.focus(); await skillField.press('ControlOrMeta+A'); await page.getByRole('button', { name: 'Italic selection' }).click(); await saved(); assert.match((await exportFile('YAML')).toString(), /\*Analytical thinking\*/); await page.keyboard.press('ControlOrMeta+Z');
  await skillField.focus(); await skillField.press('ControlOrMeta+A'); await page.getByRole('button', { name: 'Insert link' }).click(); await page.getByLabel('Link URL').fill('javascript:alert(1)'); await page.getByRole('button', { name: 'Insert link', exact: true }).last().click(); await page.getByRole('alert').filter({ hasText: /https, http, mailto or tel/ }).waitFor(); await page.getByLabel('Link URL').fill('https://example.test/own'); await page.getByRole('dialog', { name: 'Insert link' }).getByRole('button', { name: 'Insert link', exact: true }).click(); await saved(); assert.match((await exportFile('YAML')).toString(), /example.test\/own/); await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('tab', { name: 'Design', exact: true }).click(); await page.getByLabel('Top Margin · page.top_margin', { exact: true }).fill(''); assert.equal(await page.getByLabel('Top Margin · page.top_margin', { exact: true }).getAttribute('type'), 'number'); await page.getByLabel('Top Margin · page.top_margin', { exact: true }).fill('0.9'); await saved(); assert.match((await exportFile('YAML')).toString(), /top_margin: 0.9in/); await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('tab', { name: 'Locale', exact: true }).click(); await page.getByLabel('Locale language').selectOption('french'); await saved(); assert.match((await exportFile('YAML')).toString(), /language: french/); await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click(); await page.getByLabel('Pdf Title · pdf_title').fill('Own CV title'); await saved(); assert.match((await exportFile('YAML')).toString(), /Own CV title/); await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('tab', { name: 'CV', exact: true }).click(); await pdfReady();

  await page.getByRole('button', { name: 'Courses', exact: true }).click(); const courses = page.locator('.rb-courses'); await courses.waitFor();
  await courses.locator('.rb-course').first().getByRole('checkbox').check(); await courses.getByRole('button', { name: /Add selected/ }).click();
  await courses.getByText('Added to My courses.', { exact: false }).waitFor(); assert.equal(await courses.locator('.rb-added').count(), 1);
  await courses.getByRole('checkbox', { name: /Select all/ }).check(); await courses.getByRole('button', { name: /Add selected/ }).click(); await page.waitForFunction(() => document.querySelectorAll('.rb-added').length === 2); await page.getByRole('dialog', { name: 'Courses for your next role' }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'YAML', exact: true }).click(); const editor = page.locator('.cm-content');
  await editor.fill('cv: {}\nunknown: preserve-this-value'); await saved();
  assert.match((await exportFile('YAML')).toString(), /preserve-this-value/); assert.equal(await page.getByRole('button', { name: 'PDF', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('img', { name: /Resume PDF/ }).count(), 1);
  await page.reload(); await ready(); if (await page.locator('.rw-preview-pane').isVisible()) await page.locator('.rw-pdf-page canvas').first().waitFor({ state: 'attached' });
  assert.equal(await page.getByRole('button', { name: 'PDF', exact: true }).isDisabled(), true);
  assert.match((await exportFile('YAML')).toString(), /preserve-this-value/);
  assert.equal(await page.getByRole('button', { name: 'Add section', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'YAML', exact: true }).click();
  await editor.fill(yaml); await page.getByRole('button', { name: 'YAML', exact: true }).click(); await pdfReady();
  await page.getByRole('button', { name: /Add section/ }).click(); await page.getByLabel('Chapter title').fill('Projects'); await page.getByRole('dialog').getByRole('button', { name: 'Add chapter', exact: true }).click();
  await page.getByRole('button', { name: 'Add entry · Projects', exact: true }).click(); await page.getByLabel('Bullet · Projects entry 1 bullet', { exact: true }).fill('User-entered factual project.'); await saved();
  await page.getByRole('button', { name: 'Target & AI' }).click(); await page.getByRole('button', { name: 'Generate new suggestions' }).click();
  const dialog = page.getByRole('dialog', { name: 'Review AI suggestions' }); await dialog.waitFor(); await dialog.getByRole('checkbox').check(); await dialog.getByRole('button', { name: 'Apply selected chapters' }).click(); await saved();
  assert.match((await exportFile('YAML')).toString(), /User-entered factual project/); await page.getByRole('button', { name: 'Resume options' }).click(); await page.getByRole('button', { name: 'Undo AI changes' }).click(); await page.getByRole('dialog', { name: 'Resume options' }).getByRole('button', { name: 'Close', exact: true }).click(); await saved(); assert.match((await exportFile('YAML')).toString(), /User-entered factual project/);
  if (!await page.locator('.rb-job-card').count() || !await page.locator('.rb-job-card').isVisible()) await page.getByRole('button', { name: 'Target & AI' }).click(); await page.locator('input[type=file]').setInputFiles({ name: 'original.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByLabel(/Resume evidence that AI will receive/).waitFor(); assert.ok((await page.getByLabel(/Resume evidence that AI will receive/).inputValue()).length > 3);
  assert.equal(await page.getByRole('button', { name: 'Generate new suggestions' }).isDisabled(), true); await page.getByRole('button', { name: 'Remove source' }).click(); await page.getByRole('button', { name: 'Back to editing' }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('tab', { name: 'Preview', exact: true }).click(); await page.getByRole('img', { name: /Resume PDF/ }).first().waitFor(); assert.equal(await page.locator('.rw-edit-pane').isVisible(), false);
  await page.screenshot({ path: `${output}/mobile-preview.png`, fullPage: true }); await page.getByRole('tab', { name: 'Edit', exact: true }).click(); await page.getByRole('tab', { name: 'CV', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await page.getByRole('tab', { name: 'Design', exact: true }).waitFor(); await page.getByRole('button', { name: 'YAML', exact: true }).click(); await editor.waitFor(); await page.screenshot({ path: `${output}/mobile-edit.png`, fullPage: true });
  const multi = 'cv:\n  sections:\n    Skills:\n' + Array.from({ length: 90 }, () => '      - bullet: "' + 'Analytical thinking. '.repeat(20) + '"\n').join('') + 'design:\n  theme: classic\n  entries:\n    allow_page_break: true\n';
  await editor.fill(multi); await saved(); assert.equal(((await exportFile('YAML')).toString().match(/bullet:/g) || []).length, 90); await page.getByRole('tab', { name: 'Preview', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('[data-pdf-page]').length > 4); await pdfReady(); await page.getByRole('button', { name: 'Next PDF page' }).click(); await page.getByRole('img', { name: /page 2 of/ }).waitFor(); await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.reload(); await ready(); await page.getByRole('tab', { name: 'Preview', exact: true }).click(); await pdfReady();
  const totalPages = await page.locator('[data-pdf-page]').count(); assert.ok(totalPages > 4); assert.ok(await page.locator('.rw-pdf-page canvas').count() < totalPages, 'Only visible and adjacent pages use canvases');
  await page.getByLabel('PDF page', { exact: true }).fill(String(totalPages)); await page.getByRole('img', { name: new RegExp(`page ${totalPages} of`) }).waitFor();
  assert.ok(await page.locator('.rw-pdf-page canvas').count() <= 4);
  const nineEntries = { cv: { sections: {
    Skills: [{ bullet: 'Own SQL skill' }], Text: ['Own supplied text'], 'One line': [{ label: 'Own label', details: 'Own details' }],
    Experience: [{ company: 'Own organisation', position: 'Own role', highlights: ['Own fact A', 'Own fact B'] }],
    Education: [{ institution: 'Own institution', area: 'Own major' }], Projects: [{ name: 'Own project' }],
    Publications: [{ title: 'Own publication', authors: ['Own author A', 'Own author B'] }], Numbered: [{ number: 'Own numbered fact' }], Reverse: [{ reversed_number: 'Own reverse fact' }],
  } }, design: { theme: 'classic' } };
  await page.getByRole('tab', { name: 'Edit', exact: true }).click(); await page.getByRole('button', { name: 'YAML', exact: true }).click(); await editor.fill(JSON.stringify(nineEntries)); await saved(); await page.getByRole('button', { name: 'YAML', exact: true }).click(); await page.getByRole('tab', { name: 'CV', exact: true }).click();
  assert.equal(await page.locator('.rw-section').count(), 10, 'All chapters are continuous, not selected-card editing');
  const highlightA = page.getByLabel('Highlights · Experience entry 1 highlights item 1', { exact: true }); assert.equal(await highlightA.inputValue(), 'Own fact A');
  await page.getByRole('button', { name: 'Move Highlights item 1 down · Experience entry 1 highlights', exact: true }).click(); assert.equal(await highlightA.inputValue(), 'Own fact B');
  await page.getByRole('button', { name: 'Add Highlights item · Experience entry 1 highlights', exact: true }).click(); await page.getByLabel('Highlights · Experience entry 1 highlights item 3', { exact: true }).fill('Own fact C');
  await page.getByRole('button', { name: 'Remove Highlights item 3 · Experience entry 1 highlights', exact: true }).click(); assert.equal(await page.getByLabel('Highlights · Experience entry 1 highlights item 3', { exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Add Authors item · Publications entry 1 authors', exact: true }).click(); await page.getByLabel('Authors · Publications entry 1 authors item 3', { exact: true }).fill('Own author C');
  await page.getByRole('button', { name: 'Move Authors item 3 up · Publications entry 1 authors', exact: true }).click(); assert.equal(await page.getByLabel('Authors · Publications entry 1 authors item 2', { exact: true }).inputValue(), 'Own author C');
  await page.getByRole('button', { name: 'Add Social Networks item · Personal social_networks', exact: true }).click();
  await page.getByLabel('Network · Personal social_networks item 1 network', { exact: true }).selectOption('GitHub'); await page.getByLabel('Username · Personal social_networks item 1 username', { exact: true }).fill('own-user');
  await page.getByRole('button', { name: 'Add another email', exact: true }).click(); await page.getByLabel('Email · Personal email item 1', { exact: true }).fill('own@example.com');
  await page.getByRole('button', { name: 'Add Custom Connections item · Personal custom_connections', exact: true }).click();
  await page.getByLabel('Fontawesome Icon · Personal custom_connections item 1 fontawesome_icon', { exact: true }).fill('link'); await page.getByLabel('Placeholder · Personal custom_connections item 1 placeholder', { exact: true }).fill('Own site'); await page.getByLabel('Url · Personal custom_connections item 1 url', { exact: true }).fill('https://example.test');
  await page.getByRole('button', { name: 'Rename Projects section', exact: true }).click(); await page.getByLabel('New chapter title').fill('Own Projects'); await page.getByRole('dialog').getByRole('button', { name: 'Rename', exact: true }).click(); await page.getByRole('button', { name: 'Move Own Projects section up', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Text section', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(await page.locator('.rw-section[data-title="Text"]').count(), 1);
  await page.getByRole('button', { name: 'Delete Text section', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Remove chapter', exact: true }).click(); assert.equal(await page.locator('.rw-section[data-title="Text"]').count(), 0); await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await page.locator('.rw-section[data-title="Text"]').count(), 1);
  await saved(); const fullCore = (await exportFile('YAML')).toString(); assert.match(fullCore, /Own author C/); assert.match(fullCore, /Own Projects/);
  await page.getByRole('button', { name: 'YAML', exact: true }).click(); assert.match(await editor.innerText(), /Own author C/); await page.getByRole('button', { name: 'YAML', exact: true }).click(); assert.equal((await exportFile('YAML')).toString(), fullCore);
  await page.getByRole('tab', { name: 'Preview', exact: true }).click(); await pdfReady(); assert.ok((await exportFile('PDF')).equals(lastPdf));
  await page.setViewportSize({ width: 1024, height: 900 }); await page.getByRole('separator', { name: 'Resize editor and preview' }).waitFor(); await page.screenshot({ path: `${output}/tablet-wide.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 820, height: 900 }); await page.getByRole('tab', { name: 'Edit', exact: true }).click(); assert.equal(await page.locator('.rw-preview-pane').isVisible(), false); await page.screenshot({ path: `${output}/tablet-edit.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${output}/mobile-core.png`, fullPage: true }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('link', { name: 'Return to Possibilities', exact: true }).click(); await page.waitForURL(`${origin}/career/possibilities`); assert.equal(await page.locator('.workspace-editor-focus').count(), 0); assert.equal(await page.evaluate(() => localStorage.getItem('aiwrevolusi.sidebar.collapsed')), navPreference);
  await page.goto(`${origin}/career/possibilities/resume`); await ready(); await page.getByRole('tab', { name: 'Preview', exact: true }).click(); await pdfReady();
  owner = 'qa-account-b'; workspace = { ...base }; await page.reload(); await ready(); assert.equal(await job.inputValue(), ''); assert.equal(await page.getByRole('img', { name: /Resume PDF/ }).count(), 0);
  owner = 'qa-account-a'; workspace = { ...base }; await page.reload(); await ready(); await pdfReady();
  await page.getByRole('button', { name: 'Account menu', exact: true }).click(); await page.getByRole('button', { name: /Log out/ }).click(); await page.waitForURL(`${origin}/`); assert.equal(await page.getByRole('img', { name: /Resume PDF/ }).count(), 0);
  signedIn = true; await page.goto(`${origin}/career/possibilities/resume`); await ready(); await pdfReady();
  await page.getByRole('button', { name: 'Resume options' }).click(); await page.getByRole('button', { name: 'Clear local resume data' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear local resume', exact: true }).click(); await job.waitFor(); assert.equal(await job.inputValue(), '');
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
  assert.match(await page.getByLabel('Skills explicitly listed in your original resume').inputValue(), /Python/); await saved();
  await page.getByRole('button', { name: 'Generate my resume' }).click(); await pdfReady();
  assert.ok(latestInput.skills.some(skill => skill.name === 'Python')); assert.doesNotMatch(JSON.stringify(latestInput), /Alex Example|alex@example.com|412 345/);
  assert.ok(sync.every(payload => !JSON.stringify(payload).includes('QA TARGET PRIVATE') && !Object.keys(payload.data).some(key => key.includes('resume')))); assert.deepEqual(errors, []);
  console.log('PASS: focused workbench/menu restoration, split pointer/keyboard, four tabs/explicit controls, selection formatting/safe links, undo/redo, all nine entry types and nested lists, rename/reorder/delete, tablet/phone overflow, lazy continuous PDF; example fill/replace/cancel/restore, local zero-skill draft without AI/courses, skill-error protection, collapsed privacy, first-use/retry/recovery, same PDF export, course partial/all, YAML recovery, section apply/undo, PDF import, desktop/mobile/keyboard, pagination/zoom, account isolation/logout/clear, no resume sync, invalid/encrypted/textless sources, DOCX/My Plan handoff and original-skill review.');
} catch (error) { console.error(errors, await page.evaluate(() => ({ width: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('body *')].map(el => ({ tag: el.tagName, cls: typeof el.className === 'string' ? el.className : '', text: (el.textContent || '').slice(0, 45), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(el => el.right > innerWidth + 1 && el.left >= 0).slice(0, 30) })), await page.locator("body").innerText()); await page.screenshot({ path: `${output}/failure.png`, fullPage: true }); throw error; } finally { await context.close(); await browser.close(); }
