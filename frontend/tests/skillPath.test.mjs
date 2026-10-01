import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSkillPath } from '../src/features/skills/skillPath.ts';

const skill=(id,taskIds)=>({skill:{wef_skill_id:id,core_skill:`Skill ${id}`},tasks:taskIds.map(id=>({id})),highTaskCount:0});
test('path draws connections only through shared tasks and preserves all recommendations',()=>{
  const ranked=[skill(1,['a']),skill(2,['b']),skill(3,['a','b']),skill(4,['a']),skill(5,['c'])];
  const path=buildSkillPath(ranked);
  assert.equal(path.start.skill.wef_skill_id,1);
  assert.deepEqual(path.connected.map(item=>item.skill.wef_skill_id),[3,4]);
  assert.deepEqual(path.additional.map(item=>item.skill.wef_skill_id),[2,5]);
  assert.equal([path.start,...path.connected,...path.additional].length,ranked.length);
});
test('path supports empty evidence, a single area and unrelated work without invented links',()=>{
  assert.deepEqual(buildSkillPath([]),{start:null,connected:[],additional:[]});
  const first=skill(1,['a']);
  assert.deepEqual(buildSkillPath([first]),{start:first,connected:[],additional:[]});
  assert.deepEqual(buildSkillPath([first,skill(2,['b'])]).connected,[]);
});
