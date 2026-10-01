import test from 'node:test';
import assert from 'node:assert/strict';
import { taskResearch } from '../src/features/ai-impact/taskResearch.ts';

const task = { id: 'my-task', iloTaskId: '3', wording: 'Prepare cost estimates', score2025: 0.9 };
const reference = {
  ilo_task_id: '3', task_text: 'Prepare cost estimates', score_2025: 0.415,
  similarity: 1, source_method: 'predicted',
};
const assessment = {
  task_id: 'my-task', match_layer: 'exact', missing_data_status: 'complete',
  baseline_score: 0.8, adjusted_score: 0.95, matched_reference_tasks: [reference],
};

test('uses individual published evidence without raw, baseline or adjusted score substitution', () => {
  const result = taskResearch(task, assessment);
  assert.equal(result.kind, 'linked');
  assert.deepEqual(result.references, [reference]);
  assert.equal(result.references[0].score_2025, 0.415);
  assert.equal(Object.hasOwn(result, 'score'), false);
});

test('accepts a genuine zero and both scale endpoints', () => {
  for (const score of [0, 1]) {
    const result = taskResearch(task, { ...assessment, matched_reference_tasks: [{ ...reference, score_2025: score }] });
    assert.equal(result.kind, 'linked');
    assert.equal(result.references[0].score_2025, score);
  }
});

test('invalid source scores never become numeric findings', () => {
  for (const score of [-0.1, 1.1, NaN, Infinity, -Infinity, null, undefined, '0.4']) {
    const result = taskResearch(task, { ...assessment, matched_reference_tasks: [{ ...reference, score_2025: score }] });
    assert.equal(result.kind, 'gap');
    assert.deepEqual(result.references, []);
  }
});

test('missing and insufficient assessments override stale raw scores', () => {
  for (const evidence of [undefined, null, { ...assessment, match_layer: 'insufficient_data' },
    { ...assessment, missing_data_status: 'no_reliable_match' },
    { ...assessment, missing_data_status: 'missing_reference_tasks' },
    { ...assessment, task_id: 'another-task' },
    { ...assessment, matched_reference_tasks: [] },
    { ...assessment, matched_reference_tasks: undefined }]) {
    assert.deepEqual(taskResearch(task, evidence), { kind: 'gap', label: 'No supported research link', references: [] });
  }
});

test('exact matching tolerates case and whitespace only', () => {
  assert.equal(taskResearch({ ...task, wording: '  PREPARE   cost\n estimates ' }, assessment).kind, 'linked');
  for (const changed of [
    { ...task, wording: 'Approve cost estimates', originalWording: task.wording },
    { ...task, wording: 'Prepare cost estimates and approve budgets' },
    { ...task, iloTaskId: 'different' },
    { ...task, iloTaskId: undefined },
  ]) assert.equal(taskResearch(changed, assessment).kind, 'gap');
});

test('contradictory and incomplete exact references fail closed', () => {
  for (const references of [[reference, { ...reference, ilo_task_id: 'other' }],
    [reference, { ...reference, score_2025: null }],
    [{ ...reference, ilo_task_id: '' }], [{ ...reference, task_text: ' ' }], [null]]) {
    assert.equal(taskResearch(task, { ...assessment, matched_reference_tasks: references }).kind, 'gap');
  }
});

test('NLP and LLM remain candidates even with perfect confidence and identical wording', () => {
  for (const layer of ['nlp', 'llm']) {
    const result = taskResearch(task, { ...assessment, match_layer: layer, confidence: 1 });
    assert.equal(result.kind, 'candidate');
    assert.deepEqual(result.references, [reference]);
  }
});

test('candidate evidence preserves separate source values and excludes malformed entries', () => {
  const second = { ...reference, ilo_task_id: '7', task_text: 'Check quantities', score_2025: 0.1775 };
  const result = taskResearch(task, { ...assessment, match_layer: 'nlp',
    matched_reference_tasks: [reference, second, { ...reference, score_2025: 3 }] });
  assert.equal(result.kind, 'candidate');
  assert.deepEqual(result.references, [reference, second]);
});

test('unknown match layers and candidates with no valid evidence remain gaps', () => {
  for (const changed of [
    { ...assessment, match_layer: 'future_method' },
    { ...assessment, match_layer: 'llm', matched_reference_tasks: [{ ...reference, score_2025: NaN }] },
  ]) assert.equal(taskResearch(task, changed).kind, 'gap');
});
