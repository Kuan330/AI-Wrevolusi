import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskSkillQuery, SKILL_QUERY_LIMIT } from '../src/pages/Skills/lib/taskSkillQuery.ts';

test('a task within the search limit remains unchanged', () => {
  const task = 'Prepare monthly sales reports and explain changes to the team.';
  assert.deepEqual(prepareTaskSkillQuery(task), { fullTask: task, query: task, requiresFocus: false });
  const boundary = 'a'.repeat(SKILL_QUERY_LIMIT);
  assert.equal(prepareTaskSkillQuery(boundary).query, boundary);
});

test('a long task never silently searches only its beginning', () => {
  const task = 'Review daily operations. '.repeat(20) + 'Analyse inventory variances.';
  const prepared = prepareTaskSkillQuery(task);
  assert.equal(prepared.query, '');
  assert.equal(prepared.requiresFocus, true);
  assert.equal(prepared.fullTask, task);
  assert.ok(prepared.fullTask.endsWith('Analyse inventory variances.'));
});

test('a user can choose a late activity without losing the full original task', () => {
  const task = 'Review daily operations. '.repeat(20) + 'Analyse inventory variances.';
  const prepared = prepareTaskSkillQuery(task);
  const selectedActivity = prepared.fullTask.slice(prepared.fullTask.indexOf('Analyse inventory'));
  const focused = prepareTaskSkillQuery(selectedActivity);
  assert.equal(focused.query, 'Analyse inventory variances.');
  assert.equal(focused.requiresFocus, false);
  assert.equal(prepared.fullTask, task);
});
