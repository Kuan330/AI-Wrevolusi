import test from 'node:test';
import assert from 'node:assert/strict';
import { taskOverview } from '../src/pages/AIExposure/lib/taskOverview.ts';
const tasks = [
  { id: 'a', score2025: 0.3 },
  { id: 'b', score2025: 0.65 },
  { id: 'c', score2025: 0 },
  { id: 'd', score2025: null },
  { id: 'e', score2025: null },
];
const assessments = [{ task_id: 'd', baseline_score: 0.85, adjusted_score: 0.9 }];

test('personal overview excludes missing scores and includes genuine zero scores', () => {
  const overview = taskOverview(tasks, assessments);
  assert.equal(overview.scored.length, 4);
  assert.equal(overview.missingCount, 1);
  assert.equal(overview.mean, 0.45);
});

test('priorities use the three highest evidence scores',()=>{
  const overview = taskOverview(tasks, assessments);
  assert.deepEqual(overview.priorities.map(({ task }) => task.id), ['d', 'b', 'a']);
  assert.equal(overview.priorities[0].score, 0.85);
});

test('empty or unscored data has no fabricated mean', () => {
  for (const input of [[], [{ id: 'missing', score2025: null }]]) {
    const overview = taskOverview(input, []);
    assert.equal(overview.mean, null);
    assert.deepEqual(overview.priorities, []);
  }
});
