import test from 'node:test';
import assert from 'node:assert/strict';
import { skillMatch } from '../src/pages/Possibilities/possibilitiesModel.ts';
import { mergeCareerSkills } from '../src/features/skills/careerPath.ts';
import { buildSkillPath } from '../src/features/skills/skillPath.ts';

test('career percentage counts distinct evidence skills, not a saved intention', () => {
  const skills = ['have', 'suggested', 'learning', 'missing', 'shortlisted'].map((state, i) => ({ skill_id: i + 1, state }));
  assert.deepEqual(skillMatch(skills), { matched: 3, total: 5, percent: 60 });
  assert.deepEqual(skillMatch([...skills, skills[0]]), skillMatch(skills));
  assert.deepEqual(skillMatch([]), { matched: 0, total: 0, percent: null });
  assert.equal(skillMatch([{ skill_id: 1, state: 'missing' }]).percent, skillMatch([{ skill_id: 1, state: 'shortlisted' }]).percent);
});
test('career choices merge without displacing task recommendations or inventing task evidence', () => {
  const skills = [1,2,3].map(wef_skill_id => ({ wef_skill_id, core_skill: `Skill ${wef_skill_id}` }));
  const original = [{ skill: skills[0], tasks: [{ id: 't1' }], highTaskCount: 1 }];
  const merged = mergeCareerSkills(original, skills, [1,2,2,999]);
  assert.deepEqual(merged.map(item => item.skill.wef_skill_id), [1,2]);
  assert.equal(original.length, 1);
  assert.equal(merged[0], original[0]);
  assert.deepEqual(merged[1].tasks, []);
  assert.deepEqual(buildSkillPath(merged).connected, []);
  assert.equal(buildSkillPath(merged).additional[0].skill.wef_skill_id, 2);
  assert.equal(buildSkillPath(mergeCareerSkills([], skills, [3])).start.skill.wef_skill_id, 3);
});
