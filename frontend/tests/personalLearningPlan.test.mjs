import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { accountStorage, activateWorkspace } from '../src/services/accountStorage.ts';
import { generatePersonalPlan, recommendCourses, selectPlanCourses, savePersonalPlan, readPersonalPlan, readPersonalPlans, LEARNING_PLAN_DRAFT_KEY, formatDays } from '../src/features/learning-goals/personalLearningPlan.ts';
import { changeSavedCourses } from '../src/features/learning-planning/courseOperations.ts';
import { resetCourseDirectory } from '../src/features/learning-planning/courseDirectory.ts';

const memory = new Map();
const libraryKey = 'aiwrevolusi.courseLibrary.v1';
const coursePlanKey = 'aiwrevolusi.plan.courses.v1';
const inputs = { experience: 'new', minutesPerDay: 30, goalKind: 'career', goalText: 'Build a data project' };
const course = (id, level = 'beginner', overrides = {}) => ({
  id, title: `Course ${id}`, provider: 'Provider', level, language: 'English', format: 'online', selfPaced: true,
  durationMin: 60, register: 'not-required', url: `https://provider.example/${id}`, skills: ['analytical-thinking'], match: {},
  intro: '', outcomes: [], prereq: '', chapters: [{ title: 'Introduction', min: 20 }, { title: 'Application', min: 40 }], advice: '', ...overrides,
});
const generate = (overrides = {}) => generatePersonalPlan({ goalId: 'goal-1', goalTitle: 'Develop analytical thinking', skillId: 'analytical-thinking', skillLabel: 'Analytical thinking', courses: [course('a')], inputs, ...overrides });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const catalogue = () => response({ found: true, courses: [
  { course_id: 'a', skill_id: 'analytical-thinking', title: 'Course a', provider: 'Provider', level: 'Beginner', duration_min: 60, chapters: [{ title: 'Introduction', duration_min: 20 }, { title: 'Application', duration_min: 40 }] },
  { course_id: 'b', skill_id: 'analytical-thinking', title: 'Course b', provider: 'Provider', level: 'Intermediate', duration_min: 30, chapters: [] },
] });
let patchBodies;
beforeEach(() => {
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  globalThis.window = new EventTarget();
  activateWorkspace(null);
  memory.clear(); resetCourseDirectory(); patchBodies = [];
  activateWorkspace('learner', { data: {}, revision: 0 });
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/learning/courses')) return catalogue();
    assert.match(String(url), /\/account\/workspace$/);
    const body = JSON.parse(init.body); patchBodies.push(body);
    return response({ data: body.data, revision: body.revision + 1 });
  };
});
afterEach(() => activateWorkspace(null));

test('recommendations are relevant, stable, deduplicated and limited to three', () => {
  const courses = [course('z', 'advanced'), course('b'), course('a'), course('c'), course('other', 'beginner', { skills: ['other'] }), course('duplicate', 'beginner', { url: 'https://provider.example/a?utm_source=test#top' })];
  const before = structuredClone(courses);
  assert.deepEqual(recommendCourses(courses, inputs, 'analytical-thinking').courses.map(item => item.id), ['a', 'b', 'c']);
  assert.deepEqual(courses, before);
  assert.deepEqual(recommendCourses(courses, inputs, '').courses, []);
});
test('experience level changes the first recommendation', () => {
  const courses = [course('a'), course('b', 'intermediate'), course('c', 'advanced')];
  for (const [experience, first] of [['new', 'a'], ['some', 'b'], ['comfortable', 'c']]) {
    assert.equal(recommendCourses(courses, { ...inputs, experience }, 'analytical-thinking').courses[0].id, first);
  }
});
test('all published chapters and durations are preserved, not truncated to three', () => {
  const chapters = [10, 15, 20, 25, 30].map((min, i) => ({ title: `Chapter ${i}`, min }));
  const plan = generate({ courses: [course('a', 'beginner', { durationMin: 100, chapters })] });
  assert.equal(plan.activities.filter(item => item.kind === 'course').length, 5);
  assert.equal(plan.totals.courseMinutes, 100);
  assert.equal(plan.totals.minutes, 160);
  assert.equal(plan.estimatedDays, 6);
  assert.equal(plan.activities[0].courseTitle, 'Course a');
});
test('missing chapter times use the course remainder exactly and are labelled estimates', () => {
  const plan = generate({ courses: [course('a', 'beginner', { durationMin: 101, chapters: [{ title: 'Known', min: 10 }, { title: 'Unknown one', min: null }, { title: 'Unknown two', min: null }] })] });
  assert.equal(plan.totals.courseMinutes, 101);
  assert.deepEqual(plan.activities.slice(0, 3).map(item => item.minutes), [10, 46, 45]);
  assert.equal(plan.activities[1].estimated, true);
});
test('practice-only plans and unknown course durations do not fabricate lessons', () => {
  const plan = generate({ courses: [], inputs: { ...inputs, minutesPerDay: 15 } });
  assert.deepEqual(plan.courseIds, []);
  assert.deepEqual(plan.activities.map(item => item.kind), ['practice', 'review']);
  assert.equal(plan.totals.minutes, 30); assert.equal(plan.estimatedDays, 2);
  const unknown = generate({ courses: [course('a', 'beginner', { durationMin: null, chapters: null })] });
  assert.equal(unknown.activities[0].estimated, true);
  assert.equal(unknown.activities[0].title, 'Complete the course');
  assert.equal(formatDays(0), '1 day');
});
test('course selection updates totals without mutating the blueprint or inputs', () => {
  const options = { ...inputs }; const plan = generate({ courses: [course('a'), course('b')], inputs: options });
  const before = structuredClone(plan);
  const selected = selectPlanCourses(plan, ['b']);
  assert.deepEqual(selected.courseIds, ['b']); assert.equal(selected.totals.courseMinutes, 60);
  assert.equal(selected.totals.minutes, selected.activities.reduce((sum, item) => sum + item.minutes, 0));
  options.goalText = 'Changed externally';
  assert.deepEqual(plan, before);
  assert.throws(() => generate({ inputs: { ...inputs, goalText: ' ' } }), /Describe/);
});
test('plans and reference materials survive account reload and separate goals retain history', async () => {
  const resources = [{ id: 'file', kind: 'file', name: 'notes.md', text: '# Notes', sizeBytes: 7 }, { id: 'link', kind: 'link', name: 'Reference', url: 'https://example.com/guide' }];
  const first = generate({ resources });
  await savePersonalPlan(first);
  const second = generate({ goalId: 'goal-2' }); await savePersonalPlan(second);
  const revision = patchBodies.at(-1);
  activateWorkspace('learner', { data: revision.data, revision: revision.revision + 1 });
  assert.equal(readPersonalPlan('goal-1').resources[0].text, '# Notes');
  assert.equal(readPersonalPlan('goal-2').id, second.id);
  const regenerated = generate(); await savePersonalPlan(regenerated);
  assert.equal(readPersonalPlan('goal-1').id, regenerated.id);
  assert.equal(readPersonalPlans().find(item => item.id === first.id).status, 'archived');
  assert.equal(readPersonalPlans().length, 3);
});
test('corrupt plans are rejected without overwriting any stored records', async () => {
  const good = generate();
  for (const bad of [ { ...good, totals: { ...good.totals, minutes: -1 } }, { ...good, status: 'active' }, { ...good, activities: [{ ...good.activities[0], minutes: NaN }] }, { ...good, resources: [{ id: 'link', kind: 'link', name: 'Unsafe', url: 'javascript:alert(1)' }] } ]) {
    const raw = JSON.stringify({ version: 1, plans: [bad] });
    activateWorkspace('learner', { data: { [LEARNING_PLAN_DRAFT_KEY]: raw }, revision: 0 });
    assert.throws(() => readPersonalPlan(), /could not be read/);
    await assert.rejects(savePersonalPlan(good), /could not be read/);
    assert.equal(accountStorage.getItem(LEARNING_PLAN_DRAFT_KEY), raw);
  }
});
test('acceptance commits blueprint, courses and schedule choices in one acknowledged write', async () => {
  const plan = generate(); await savePersonalPlan(plan); patchBodies = [];
  const result = await changeSavedCourses({ add: ['a'], personalPlan: plan });
  assert.equal(patchBodies.length, 1);
  assert.equal(readPersonalPlan('goal-1').status, 'active');
  assert.ok(readPersonalPlan('goal-1').acceptedAt);
  assert.deepEqual(JSON.parse(accountStorage.getItem(libraryKey)).saved, ['a']);
  assert.deepEqual(result.library.choices.a.weekdays, []);
  assert.equal(result.library.choices.a.minutesPerDay, 30);
  assert.equal(JSON.parse(accountStorage.getItem(coursePlanKey)).courses[0].id, 'a');
});
test('failed acceptance leaves draft and course records unchanged and can retry', async () => {
  const plan = generate(); await savePersonalPlan(plan);
  const before = [LEARNING_PLAN_DRAFT_KEY, libraryKey, coursePlanKey].map(key => accountStorage.getItem(key));
  globalThis.fetch = async url => String(url).includes('/learning/courses') ? catalogue() : response({ detail: 'Offline test failure' }, 503);
  await assert.rejects(changeSavedCourses({ add: ['a'], personalPlan: plan }));
  assert.deepEqual([LEARNING_PLAN_DRAFT_KEY, libraryKey, coursePlanKey].map(key => accountStorage.getItem(key)), before);
  globalThis.fetch = async (_url, init) => { const body = JSON.parse(init.body); return response({ data: body.data, revision: 2 }); };
  await changeSavedCourses({ add: ['a'], personalPlan: plan });
  assert.equal(readPersonalPlan().status, 'active');
});
test('catalogue failures, missing courses and mismatched selections never partially accept', async () => {
  const plan = generate(); await savePersonalPlan(plan);
  await assert.rejects(changeSavedCourses({ add: [], personalPlan: plan }), /selected courses changed/);
  await assert.rejects(changeSavedCourses({ add: ['gone'], personalPlan: { ...plan, courseIds: ['gone'] } }), /no longer available/);
  resetCourseDirectory(); globalThis.fetch = async () => { throw Error('Unavailable catalogue'); };
  await assert.rejects(changeSavedCourses({ add: ['a'], personalPlan: plan }), /Unavailable/);
  assert.equal(readPersonalPlan().status, 'draft'); assert.equal(accountStorage.getItem(libraryKey), null);
});
test('a practice-only plan can be accepted without catalogue access', async () => {
  const plan = generate({ courses: [] }); await savePersonalPlan(plan);
  globalThis.fetch = async (url, init) => { assert.doesNotMatch(String(url), /learning\/courses/); const body = JSON.parse(init.body); return response({ data: body.data, revision: 2 }); };
  await changeSavedCourses({ add: [], personalPlan: plan });
  assert.equal(readPersonalPlan().status, 'active'); assert.deepEqual(readPersonalPlan().courseIds, []);
});
