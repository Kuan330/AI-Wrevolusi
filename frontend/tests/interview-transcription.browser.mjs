/** Recording integration. AIW_REAL_TRANSCRIPTION=1 uses the local backend's real speech provider. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.AIW_QA_ORIGIN || 'http://127.0.0.1:5194', live = process.env.AIW_REAL_TRANSCRIPTION === '1';
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const output = fileURLToPath(new URL('../../.local/interview-transcription/', import.meta.url)); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.AIW_QA_BROWSER_PATH ? { executablePath: process.env.AIW_QA_BROWSER_PATH } : { channel: 'chrome' }),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(process.env.AIW_QA_AUDIO ? [`--use-file-for-fake-audio-capture=${process.env.AIW_QA_AUDIO}`] : [])] });
const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1400, height: 1000 } });
const page = await context.newPage(); page.setDefaultTimeout(20000);
const errors = [], uploads = [], feedback = [];
let fail = false, hold = false, release;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin && !['blob:', 'data:'].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const path = url.pathname.replace('/api/v1', '');
  if (path === '/account/me') return json(route, { id: 'qa-brave-transcription', username: 'qa-voice' });
  if (path === '/account/workspace') return json(route, { owner_id: 'qa-brave-transcription', data: {}, revision: 0 });
  if (path === '/interview/transcription-capabilities') return live ? route.continue() : json(route, { configured: true });
  if (path === '/interview/transcribe') {
    uploads.push({ contentType: request.headers()['content-type'], bytes: request.postDataBuffer()?.length });
    if (hold) { await new Promise(done => { release = done; }); return json(route, { text: 'Late result must be ignored.' }).catch(() => {}); }
    if (fail) return json(route, { detail: 'Speech service is unavailable. Try again.' }, 503);
    return live ? route.continue() : json(route, { text: 'I prepared the weekly report. I checked the totals.' });
  }
  if (path === '/interview/feedback') {
    feedback.push(request.postDataJSON());
    return json(route, { summary: 'Saved for this test.', checks: [], improvements: [], follow_up: null, skill_gap: null });
  }
  if (path === '/interview/question-bank') return json(route, { occupation_code: '0000', matched: 'common', questions: [] });
  if (path === '/interview/plan') return json(route, { source: 'template', questions: [{ text: 'Tell me about your work.', kind: 'general', item_id: null, topic_id: null, bank_id: null }] });
  if (path === '/reference/wef-skills') return json(route, []);
  return json(route, {});
});
const start = async () => {
  await page.getByRole('button', { name: /^(Start recording|Record again)$/ }).click();
  await page.getByText('Recording. Speak now.', { exact: true }).waitFor();
  await page.waitForTimeout(live ? 6500 : 1200);
};
const answer = page.getByRole('textbox', { name: 'Your answer', exact: true });
try {
  await page.goto(`${origin}/career/possibilities/interview`);
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  await answer.fill('Existing draft.');
  await page.getByRole('button', { name: 'Speak', exact: true }).click();
  await start();
  assert.equal(uploads.length, 0, 'Audio is not sent while recording');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByRole('button', { name: 'Record again', exact: true }).waitFor({ timeout: 60000 });
  assert.match(await answer.inputValue(), /Existing draft\. I prepared the weekly report\./);
  assert.match(await answer.inputValue(), /checked the totals/i);
  assert.match(uploads[0].contentType, /^audio\//); assert.ok(uploads[0].bytes > 100);
  await page.screenshot({ path: `${output}/brave-transcript.png`, fullPage: true });

  const before = await answer.inputValue();
  await start(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(uploads.length, 1); assert.equal(await answer.inputValue(), before);
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await page.getByText('Saved for this test.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  assert.equal(feedback.length, 1);

  hold = true;
  await page.getByRole('button', { name: 'Speak', exact: true }).click(); await start();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByText('Transcribing your recording…', { exact: true }).waitFor();
  const deadline = Date.now() + 3000;
  while (!release && Date.now() < deadline) await new Promise(done => setTimeout(done, 10));
  assert.ok(release, 'The pending transcription request reached the test server');
  const kept = await answer.inputValue();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); release();
  await page.getByRole('button', { name: 'Start recording', exact: true }).waitFor();
  assert.equal(await answer.inputValue(), kept);
  hold = false; fail = true;
  await start(); await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.getByText('Speech service is unavailable. Try again.', { exact: true }).waitFor();
  assert.equal(await answer.inputValue(), kept);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ realProvider: live, audioUpload: 'passed', transcript: 'passed', cancelBeforeUpload: 'passed', cancelPendingTranscript: 'passed', providerFailureKeepsAnswer: 'passed', pageErrors: errors }));
} finally { await browser.close(); }
