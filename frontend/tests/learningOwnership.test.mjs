import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { accountStorage, activateWorkspace, flushWorkspace, syncError } from '../src/services/accountStorage.ts';
import { saveConfirmedAnalysis, saveTaskPractice, writeUserProfile, readUserProfile } from '../src/features/work-profile/userProfile.ts';
import { learningNeedsReview, markLearningReviewed } from '../src/features/work-profile/reviewState.ts';
import { readPlanState, savePlanState, syncPlanWithLearningCourses } from '../src/features/learning-planning/planCourses.ts';
import { changeSavedCourses } from '../src/features/learning-planning/courseOperations.ts';
import { resetCourseDirectory } from '../src/features/learning-planning/courseDirectory.ts';
import { localPlanRepository } from '../src/services/planService.ts';
import { readLearningSkills, saveLearningSkills } from '../src/pages/Skills/learningSkills.ts';

const memory = new Map();
const libraryKey = 'aiwrevolusi.courseLibrary.v1';
const planKey = 'aiwrevolusi.plan.courses.v1';
const calendarKey = 'aiwrevolusi.planner.v1';
const course = { id: 'course-1', title: 'Course', provider: 'Provider', chapters: [{ title: 'Start', value: 4 }] };
const plan = () => ({ version: 1, courses: [course], records: { '2026-09-17': { minutes: 30, note: 'Done', studied: true, checked: true } } });
const library = () => ({ version: 1, skillId: 'writing', saved: ['course-1'], choices: {}, basis: {}, pending: [] });
const calendar = () => ({ version: 1, revision: 2, context: 'older profile', events: [{ id: 'event', title: 'Study', kind: 'learning', date: '2026-09-18', start: '18:00', end: '18:30', flexible: true, shareable: false, completed: false }] });
const analysis = () => ({ occupationCode: '4110', occupationTitle: 'Clerk', tasks: [{ id: 'task', wording: 'Prepare records', score2025: 0.5 }], taskExposureAssessments: [] });
function seedLearning() {
  memory.set(libraryKey, JSON.stringify(library()));
  memory.set(planKey, JSON.stringify(plan()));
  memory.set(calendarKey, JSON.stringify(calendar()));
}
function response(data) {
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
}
function catalogue() {
  return response({ found: true, courses: [{ course_id: 'course-1', title: 'Course', provider: 'Provider', skill_id: 'writing', chapters: [{ title: 'Start', duration_min: 30 }] }, { course_id: 'course-2', title: 'Another', provider: 'Provider', skill_id: 'writing', chapters: [] }] });
}
beforeEach(() => {
  activateWorkspace(null);
  memory.clear();
  resetCourseDirectory();
  globalThis.localStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: key => memory.delete(key),
  };
  globalThis.sessionStorage = { getItem: () => null };
  globalThis.window = new EventTarget();
  globalThis.fetch = async () => { throw new Error('Unexpected network request in offline test'); };
});
afterEach(() => activateWorkspace(null));

test('practice preserves saved learning; structural work changes preserve it and request review', async () => {
  saveConfirmedAnalysis(analysis());
  seedLearning();
  const previous = [libraryKey, planKey, calendarKey].map(key => memory.get(key));
  saveTaskPractice('4110', 'task', 'Prepare records', current => ({ ...current, trials: [{ id: 'trial' }] }));
  assert.equal(learningNeedsReview(), false);
  assert.deepEqual([libraryKey, planKey, calendarKey].map(key => memory.get(key)), previous);
  writeUserProfile({ tasksOccupationCode: '2512', tasks: [{ id: 'other', wording: 'Develop software' }], analysis: null });
  assert.equal(learningNeedsReview(), true);
  assert.equal(readUserProfile().learningReviewNeeded, true);
  assert.deepEqual([libraryKey, planKey, calendarKey].map(key => memory.get(key)), previous);
  assert.deepEqual((await localPlanRepository().load()).events, calendar().events);
  markLearningReviewed();
  assert.equal(learningNeedsReview(), false);
  assert.deepEqual([libraryKey, planKey, calendarKey].map(key => memory.get(key)), previous);
});

test('add and remove update both views while retaining existing progress and calendar', async () => {
  seedLearning();
  globalThis.fetch = async () => catalogue();
  const added = await changeSavedCourses({ add: ['course-2'] });
  assert.deepEqual(added.library.saved, ['course-1', 'course-2']);
  assert.equal(added.plan.courses[0].chapters[0].value, 4);
  assert.deepEqual(added.plan.records, plan().records);
  const removed = await changeSavedCourses({ remove: ['course-2'] });
  assert.deepEqual(removed.library.saved, ['course-1']);
  assert.deepEqual(removed.plan.courses.map(item => item.id), ['course-1']);
  assert.deepEqual(JSON.parse(memory.get(calendarKey)), calendar());
});

test('catalogue failure and unreadable stored plan leave both saved records untouched', async () => {
  seedLearning();
  const before = [memory.get(libraryKey), memory.get(planKey)];
  await assert.rejects(changeSavedCourses({ add: ['course-2'] }), /Unexpected network/);
  assert.deepEqual([memory.get(libraryKey), memory.get(planKey)], before);
  memory.set(planKey, '{bad');
  await assert.rejects(changeSavedCourses({ remove: ['course-1'] }), /could not be read/);
  assert.equal(memory.get(libraryKey), before[0]);
  assert.equal(memory.get(planKey), '{bad');
});

test('guest storage write failure rolls back both course records', async () => {
  seedLearning();
  const before = [memory.get(libraryKey), memory.get(planKey)];
  let fail = true;
  globalThis.localStorage.setItem = (key, value) => {
    if (key === planKey && fail) { fail = false; throw new Error('Storage full'); }
    memory.set(key, value);
  };
  await assert.rejects(changeSavedCourses({ remove: ['course-1'] }), /Storage full/);
  assert.deepEqual([memory.get(libraryKey), memory.get(planKey)], before);
});

test('signed-in plans do not import or mirror guest and legacy browser records', async () => {
  seedLearning();
  const guest = memory.get(planKey);
  globalThis.sessionStorage = { getItem: () => JSON.stringify(plan()) };
  activateWorkspace('account', { data: {}, revision: 0 });
  assert.deepEqual(readPlanState().courses, []);
  savePlanState({ version: 1, courses: [], records: {} });
  assert.equal(memory.get(planKey), guest);
  let saved;
  globalThis.fetch = async (_url, init) => { saved = JSON.parse(init.body); return response({ revision: 1, data: saved.data }); };
  await flushWorkspace();
  assert.equal(saved.owner_id, 'account');
  assert.deepEqual(JSON.parse(saved.data[planKey]).courses, []);
});

test('legacy plan migration is confined to the guest workspace', () => {
  globalThis.sessionStorage = { getItem: key => key === 'aiwrevolusi.plan.learningPreview.v1' ? JSON.stringify(plan()) : null };
  assert.deepEqual(readPlanState(), plan());
  assert.deepEqual(JSON.parse(memory.get(planKey)), plan());
});

test('an account switch during catalogue loading cannot write into the new account', async () => {
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  activateWorkspace('first', { data: {}, revision: 0 });
  const pending = changeSavedCourses({ add: ['course-1'] });
  activateWorkspace('second', { data: {}, revision: 0 });
  resolve(catalogue());
  await assert.rejects(pending, /account changed/);
  assert.equal(accountStorage.getItem(libraryKey), null);
  assert.equal(accountStorage.getItem(planKey), null);
});

test('refresh retains recorded progress when a saved course is absent from the catalogue', async () => {
  seedLearning();
  globalThis.fetch = async () => response({ found: true, courses: [] });
  const refreshed = await syncPlanWithLearningCourses();
  assert.deepEqual(refreshed, plan());
});

test('skill saves after a changed work context retain saved learning records', () => {
  seedLearning();
  const before = [libraryKey, planKey, calendarKey].map(key => memory.get(key));
  const skill = { id: 'writing', name: 'Writing', source: 'custom' };
  accountStorage.setItem('aiwrevolusi.confirmedAnalysis', 'old work');
  saveLearningSkills([skill]);
  accountStorage.setItem('aiwrevolusi.confirmedAnalysis', 'new work');
  assert.deepEqual(readLearningSkills(), [skill]);
  saveLearningSkills([skill]);
  assert.deepEqual([libraryKey, planKey, calendarKey].map(key => memory.get(key)), before);
});

test('course changes reach the account server as one workspace snapshot', async () => {
  activateWorkspace('account', { data: { [libraryKey]: JSON.stringify(library()), [planKey]: JSON.stringify(plan()) }, revision: 3 });
  await changeSavedCourses({ remove: ['course-1'] });
  let snapshot;
  globalThis.fetch = async (_url, init) => { snapshot = JSON.parse(init.body); return response({ revision: 4, data: snapshot.data }); };
  await flushWorkspace();
  assert.equal(snapshot.owner_id, 'account');
  assert.equal(snapshot.revision, 3);
  assert.deepEqual(JSON.parse(snapshot.data[libraryKey]).saved, []);
  assert.deepEqual(JSON.parse(snapshot.data[planKey]).courses, []);
});

test('late workspace saves cannot change the newly active account revision', async () => {
  activateWorkspace('first', { data: {}, revision: 1 });
  accountStorage.setItem(planKey, JSON.stringify(plan()));
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  const pending = flushWorkspace();
  activateWorkspace('second', { data: {}, revision: 7 });
  resolve(response({ revision: 2, data: {} }));
  await pending;
  accountStorage.setItem(planKey, JSON.stringify(plan()));
  let next;
  globalThis.fetch = async (_url, init) => { next = JSON.parse(init.body); return response({ revision: 8, data: next.data }); };
  await flushWorkspace();
  assert.equal(next.owner_id, 'second');
  assert.equal(next.revision, 7);
});

test('account cache failure rolls back both records before server sync', async () => {
  const data = { [libraryKey]: JSON.stringify(library()), [planKey]: JSON.stringify(plan()) };
  activateWorkspace('account', { data, revision: 3 });
  globalThis.localStorage.setItem = () => { throw new Error('Cache unavailable'); };
  await assert.rejects(changeSavedCourses({ remove: ['course-1'] }), /Cache unavailable/);
  assert.equal(accountStorage.getItem(libraryKey), data[libraryKey]);
  assert.equal(accountStorage.getItem(planKey), data[planKey]);
  // The beforeEach network guard must never be called: the failed batch is clean.
  await flushWorkspace();
});

test('a failed save from a previous account does not attach its error to the new account', async () => {
  activateWorkspace('first', { data: {}, revision: 1 });
  accountStorage.setItem(planKey, JSON.stringify(plan()));
  let reject;
  globalThis.fetch = () => new Promise((_done, fail) => { reject = fail; });
  const pending = flushWorkspace();
  activateWorkspace('second', { data: {}, revision: 7 });
  reject(new Error('Old account failed'));
  await assert.rejects(pending, /Old account failed/);
  assert.equal(syncError, '');
  assert.equal(accountStorage.getItem(planKey), null);
});

test('explicit guest import can still save the selected guest plan into an account', async () => {
  seedLearning();
  const selectedGuestPlan = accountStorage.getItem(planKey);
  activateWorkspace('new-account', { data: {}, revision: 0 });
  assert.deepEqual(readPlanState().courses, []);
  // The existing registration flow applies captured guest keys only on opt-in.
  accountStorage.setItem(planKey, selectedGuestPlan);
  assert.deepEqual(readPlanState(), plan());
  let snapshot;
  globalThis.fetch = async (_url, init) => { snapshot = JSON.parse(init.body); return response({ revision: 1, data: snapshot.data }); };
  await flushWorkspace();
  assert.equal(snapshot.owner_id, 'new-account');
  assert.deepEqual(JSON.parse(snapshot.data[planKey]), plan());
});

test('skill-based course removal cannot cross an account switch during catalogue loading', async () => {
  const data = { [libraryKey]: JSON.stringify(library()), [planKey]: JSON.stringify(plan()) };
  activateWorkspace('first', { data, revision: 1 });
  let resolve;
  globalThis.fetch = () => new Promise(done => { resolve = done; });
  const pending = changeSavedCourses({ removeSkill: { id: 'writing', remainingIds: [] } });
  activateWorkspace('second', { data: { ...data }, revision: 5 });
  resolve(catalogue());
  await assert.rejects(pending, /account changed/);
  assert.equal(accountStorage.getItem(libraryKey), data[libraryKey]);
  assert.equal(accountStorage.getItem(planKey), data[planKey]);
});

test('a new-account flush waiting for an old rejected request still saves its own pending changes', async () => {
  activateWorkspace('first', { data: {}, revision: 1 });
  accountStorage.setItem(planKey, JSON.stringify(plan()));
  let rejectOld;
  let nextSnapshot;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    if (++calls === 1) return new Promise((_done, fail) => { rejectOld = fail; });
    nextSnapshot = JSON.parse(init.body);
    return response({ revision: 8, data: nextSnapshot.data });
  };
  const oldPending = flushWorkspace();
  const oldFailure = assert.rejects(oldPending, /Old account failed/);
  activateWorkspace('second', { data: {}, revision: 7 });
  accountStorage.setItem(planKey, JSON.stringify(plan()));
  const nextPending = flushWorkspace();
  rejectOld(new Error('Old account failed'));
  await oldFailure;
  await nextPending;
  assert.equal(calls, 2);
  assert.equal(nextSnapshot.owner_id, 'second');
  assert.equal(nextSnapshot.revision, 7);
  assert.deepEqual(JSON.parse(nextSnapshot.data[planKey]), plan());
  assert.equal(syncError, '');
  assert.equal(JSON.parse(memory.get('aiwrevolusi.account.second')).dirty, false);
});

test('concurrent flushes for the same account still expose its save failure', async () => {
  activateWorkspace('same', { data: {}, revision: 1 });
  accountStorage.setItem(planKey, JSON.stringify(plan()));
  let reject;
  globalThis.fetch = () => new Promise((_done, fail) => { reject = fail; });
  const first = assert.rejects(flushWorkspace(), /Own save failed/);
  const second = assert.rejects(flushWorkspace(), /Own save failed/);
  reject(new Error('Own save failed'));
  await Promise.all([first, second]);
  assert.equal(syncError, 'Own save failed');
  assert.equal(JSON.parse(memory.get('aiwrevolusi.account.same')).dirty, true);
});
