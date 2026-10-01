import test from "node:test";
import assert from "node:assert/strict";
import { acceptedCareerEvidence, acceptedDirectionSkills } from "../src/pages/Possibilities/possibilitiesModel.ts";

const evidence = [1, 2, 3].map(id => ({ skill: { wef_skill_id: id, core_skill: `Skill ${id}` }, tasks: [{ id: `task-${id}` }] }));
const directionSkills = [1, 2, 4].map(id => ({ skill_id: id, name: `Skill ${id}`, state: "have" }));

test("no review and stale reviews show no accepted career evidence", () => {
  assert.deepEqual(acceptedCareerEvidence(evidence, false, { 1: "accepted" }), []);
  assert.deepEqual(acceptedCareerEvidence(evidence, true, {}), []);
  assert.deepEqual(acceptedDirectionSkills(directionSkills, new Set()), []);
});

test("cards, details and companion share only current accepted task evidence", () => {
  const accepted = acceptedCareerEvidence(evidence, true, { 1: "accepted", 2: "rejected", 4: "accepted" });
  assert.deepEqual(accepted.map(item => item.skill.wef_skill_id), [1]);
  const acceptedIds = new Set(accepted.map(item => item.skill.wef_skill_id));
  assert.deepEqual(acceptedDirectionSkills(directionSkills, acceptedIds).map(item => item.skill_id), [1]);
  assert.deepEqual(acceptedDirectionSkills([...directionSkills].reverse(), acceptedIds).map(item => item.skill_id), [1]);
});

test("changed task evidence cannot keep a previously accepted connection", () => {
  const accepted = acceptedCareerEvidence(evidence.filter(item => item.skill.wef_skill_id !== 1), true, { 1: "accepted", 2: "rejected" });
  assert.deepEqual(acceptedDirectionSkills(directionSkills, new Set(accepted.map(item => item.skill.wef_skill_id))), []);
});
