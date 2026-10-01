import test from 'node:test';
import assert from 'node:assert/strict';
import { skillsForTask } from '../src/features/skills/matchSkills.ts';

const skills = Array.from({ length: 26 }, (_, index) => ({ wef_skill_id: index + 1, core_skill: `Skill ${index + 1}` }));
const ids = text => skillsForTask(text, skills, null).map(skill => skill.wef_skill_id);

test('recognises design, data analysis and numeracy in mechanical task wording', () => {
  assert.ok(ids('Designing and preparing layouts of machines and mechanical installations.').includes(18));
  assert.ok(ids('Conducting tests of mechanical systems, collecting and analysing data and assembling mechanical assemblies.').includes(1));
  assert.ok(ids('Collecting and analyzing data from a test.').includes(1));
  assert.deepEqual(ids('Preparing detailed estimates of quantities and costs of materials and labour required for manufacture.'), [21]);
});

test('does not infer thinking skills from mechanical systems or generic verbs', () => {
  assert.deepEqual(ids('Installing hydraulic power systems.'), []);
  assert.deepEqual(ids('Thinking about a task and reviewing items.'), []);
  assert.deepEqual(ids('Identifying a customer.'), [10]);
  assert.ok(ids('Use systems thinking to investigate a root cause.').includes(12));
});

test('keeps candidate constraints and task suggestion cap', () => {
  assert.deepEqual(skillsForTask('Designing machine layouts.', skills.filter(skill => skill.wef_skill_id !== 18), null), []);
  const text = 'Designing software, analysing data, preparing reports, quality checks and programming.';
  assert.equal(skillsForTask(text, skills).length, 3);
  assert.ok(skillsForTask(text, skills, null).length > 3);
});
