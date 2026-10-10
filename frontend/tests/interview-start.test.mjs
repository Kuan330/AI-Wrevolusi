import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { activateWorkspace } from '../src/services/accountStorage.ts';
import { availableChangeTasks, changeTopics, futureInterviewOccupation, interviewCareer, planBody } from '../src/features/interview/start.ts';
import { prepareInterviewContext } from '../src/features/interview/resumeItems.ts';

const memory = new Map();
beforeEach(() => {
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  globalThis.window = new EventTarget();
  activateWorkspace(null);
  memory.clear();
});
const save = (key, value) => memory.set(key, JSON.stringify(value));
const directionKey = 'aiwrevolusi.possibilities.chosenDirection';
const profileKey = 'aiwrevolusi.userProfile';
const task = { id: 'task-1', wording: 'Prepare reports for Aurora', iloTaskId: 'ilo-1', sourceOccupationCode: '2411' };
function profile() {
  return { jobTitle: 'Analyst', tasksConfirmed: true, tasksOccupationCode: '2411', tasks: [{ ...task }], analysis: {
    classificationCheck: 'same-title-v1', occupationCode: '2411', tasks: [{ ...task }], taskExposureAssessments: [{
      task_id: task.id, match_layer: 'exact', missing_data_status: 'complete', source_name: 'ILO', source_year: '2025',
      matched_reference_tasks: [{ ilo_task_id: 'ilo-1', task_text: task.wording, score_2025: 0.4 }],
    }],
  } };
}
const document = { cv: { sections: { Experience: [{ position: 'Analyst', company: 'Aurora', highlights: ['Prepared reports.'] }, { position: 'Assistant', company: 'Aurora', highlights: ['Checked reports.'] }] } } };

test('a saved future occupation is available without a resume or current work profile', () => {
  assert.equal(futureInterviewOccupation(), null);
  save(directionKey, { occupation_code: '2512', title: '  Software Developer  ' });
  assert.deepEqual(futureInterviewOccupation(), { code: '2512', title: 'Software Developer' });
  assert.deepEqual(interviewCareer(), { code: '2512', title: 'Software Developer' });
  assert.deepEqual(availableChangeTasks(), []);
});

test('unreadable or invalid future choices do not become an invented target role', () => {
  for (const value of [{ occupation_code: '../private', title: 'Developer' }, { occupation_code: '2512', title: '   ' }]) {
    save(directionKey, value);
    assert.equal(futureInterviewOccupation(), null);
  }
  memory.set(directionKey, '{broken');
  assert.equal(futureInterviewOccupation(), null);
});

test('only current exact research links supply a task impact value and source', () => {
  save(profileKey, profile());
  assert.deepEqual(availableChangeTasks(), [{ id: 'task-1', text: task.wording, impact_score: 0.4, reference_id: 'ilo-1', source_name: 'ILO', source_year: 2025 }]);
  const changed = profile(); changed.tasks[0].wording = 'Changed work';
  save(profileKey, changed); assert.deepEqual(availableChangeTasks(), []);
  const candidate = profile(); candidate.analysis.taskExposureAssessments[0].match_layer = 'nlp';
  save(profileKey, candidate); assert.deepEqual(availableChangeTasks(), []);
  const otherRole = profile(); otherRole.tasksOccupationCode = '2512';
  save(profileKey, otherRole); assert.deepEqual(availableChangeTasks(), []);
  const old = profile(); delete old.analysis.classificationCheck;
  save(profileKey, old); assert.deepEqual(availableChangeTasks(), []);
});

test('work-entry links are explicit, private task words are hidden, and topic IDs stay unique', () => {
  save(profileKey, profile());
  const context = prepareInterviewContext(document, 'Analyst\nUse spreadsheets.', 'Aurora');
  const work = context.display.filter(item => item.kind === 'work');
  const requirement = context.display.find(item => item.kind === 'requirement');
  assert.deepEqual(changeTopics(context, {}), [], 'similar wording alone is not a link');
  assert.deepEqual(changeTopics(context, { [requirement.id]: task.id }), [], 'requirements are not work experience');
  const topics = changeTopics(context, { [work[0].id]: task.id, [work[1].id]: task.id });
  assert.equal(topics.length, 2);
  assert.deepEqual(topics.map(item => item.item_id), work.map(item => item.id));
  assert.equal(new Set(topics.map(item => item.id)).size, 2);
  assert.ok(topics.every(item => item.impact_score === 0.4 && !item.text.includes('Aurora')));
  const body = planBody(context, [], topics, true);
  assert.equal(body.count, 4);
  assert.equal(body.items_reviewed, true);
  assert.deepEqual(body.topics, topics);
  assert.equal(body.role_title, context.sentRoleTitle);
});
