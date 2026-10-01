import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual explicit check with controlled account and API boundaries.
const source = readFileSync(new URL('../src/features/work-profile/checkWorkAiFindings.ts', import.meta.url), 'utf8');
const script = source.replace(/^import .*;\r?\n/gm, '') + '\nreturn checkWorkAiFindings;';
const compiled = ts.transpileModule(script, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('export async function', 'async function');
let profile, owner, workKey, calls, saved, duringRequest, duringFlush, classificationCheck;
const check = new Function('readJourneyProfile', 'currentWorkKey', 'currentWorkspaceSession', 'flushWorkspace', 'exposureService', 'saveConfirmedAnalysis', compiled)(
  () => profile, () => workKey, () => owner,
  async () => { calls.push('flush'); duringFlush?.(); },
  { assessConfirmedTasksAgainstIloReferences: async input => { calls.push(input); duringRequest?.(); return { assessments: [], classification_check: classificationCheck }; } },
  value => { saved = value; },
);
beforeEach(() => {
  profile = { jobTitle: 'My custom title', tasksConfirmed: true, tasksOccupationCode: '3115', tasks: [{ id: 't1', wording: 'Test equipment', timeSpent: '' }] };
  classificationCheck = 'same-title-v1'; owner = 1; workKey = 'work-v1'; calls = []; saved = undefined; duringRequest = undefined; duringFlush = undefined;
});
test('checking is explicit and preserves confirmed task text without re-confirming profile', async () => {
  assert.equal(calls.length, 0);
  await check();
  assert.deepEqual(calls.map(call => typeof call === 'string' ? call : call.occupation_code), ['flush', '3115', 'flush']);
  assert.equal(calls[1].confirmed_tasks[0].task_text, 'Test equipment');
  assert.equal(saved.occupationTitle, 'My custom title');
  assert.deepEqual(saved.tasks, profile.tasks);
});
test('unmatched work keeps an honest evidence gap without making an API request', async () => {
  profile.tasksOccupationCode = null;
  await assert.rejects(check(), /not linked to a research occupation/);
  assert.deepEqual(calls, []);
  assert.equal(saved, undefined);
});
test('draft work cannot start research', async () => {
  profile.tasksConfirmed = false;
  await assert.rejects(check(), /Confirm your profile/);
  assert.deepEqual(calls, []);
});
test('account switch during initial sync prevents the research request', async () => {
  duringFlush = () => { owner++; };
  await assert.rejects(check(), /account or work changed/);
  assert.deepEqual(calls, ['flush']);
  assert.equal(saved, undefined);
});
test('profile changes while research loads cannot overwrite current work', async () => {
  duringRequest = () => { workKey = 'work-v2'; };
  await assert.rejects(check(), /account or work changed/);
  assert.equal(saved, undefined);
});
test('account switches while research loads cannot write another account', async () => {
  duringRequest = () => { owner++; };
  await assert.rejects(check(), /account or work changed/);
  assert.equal(saved, undefined);
});


test('a newer confirmed version with unchanged wording blocks a late research response', async () => {
  profile.profileVersion = 1;
  duringRequest = () => { profile = { ...profile, profileVersion: 2 }; };
  await assert.rejects(check(), /account or work changed/);
  assert.equal(saved, undefined);
});
test('kept tasks from another occupation do not reuse old ILO IDs or occupation scores', async () => {
  profile.tasks[0] = { ...profile.tasks[0], sourceOccupationCode: '4110', iloTaskId: 'old-ilo', meanScore2025: 0.8, potential25: 'Old category' };
  await check();
  assert.equal(calls[1].confirmed_tasks[0].ilo_task_id, undefined);
  assert.equal(saved.meanScore2025, null);
  assert.equal(saved.potential25, null);
});
test('current occupation source and legacy task references remain supported', async () => {
  for (const sourceOccupationCode of ['3115', undefined]) {
    profile.tasks[0] = { ...profile.tasks[0], sourceOccupationCode, iloTaskId: 'current-ilo', meanScore2025: 0.26, potential25: 'Not exposed' };
    calls = [];
    await check();
    assert.equal(calls[1].confirmed_tasks[0].ilo_task_id, 'current-ilo');
    assert.equal(saved.meanScore2025, 0.26);
  }
});


test('only a backend-checked classification link marks new analysis', async () => {
  await check();
  assert.equal(saved.classificationCheck, 'same-title-v1');
  saved = undefined;
  classificationCheck = undefined;
  await assert.rejects(check(), /not checked the occupation classification/);
  assert.equal(saved, undefined);
});
