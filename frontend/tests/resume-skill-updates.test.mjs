import test from "node:test";
import assert from "node:assert/strict";
import { pendingResumeSkills } from "../src/features/resume/skillUpdates.ts";

const skills = names => names.map(name => ({ id: name, name }));
test("restored aggregate drafts still expose newly saved course skills", () => {
  const document = { cv: { sections: { Skills: [{ bullet: "SQL" }] } } };
  const candidates = skills(["sql", "Creative thinking", "Programming"]);
  assert.deepEqual(pendingResumeSkills(document, candidates).map(skill => skill.name), ["Creative thinking", "Programming"]);
  assert.deepEqual(pendingResumeSkills({ cv: { sections: { Skills: candidates.map(skill => ({ bullet: skill.name })) } } }, candidates), []);
  assert.deepEqual(document.cv.sections.Skills, [{ bullet: "SQL" }]);
});

test("grouped and aliased skill sections count while unrelated body text does not", () => {
  const document = { cv: { sections: {
    "Technical Skills": [{ label: "Tools", details: "SQL, Python" }, { bullet: "C++" }, "ＡＩ and big data"],
    "Core skills": ["Service orientation and customer service"],
    Experience: ["Used Java in a project."],
  } } };
  assert.deepEqual(pendingResumeSkills(document, skills(["SQL", "Python", "C", "C++", "C#", "AI and big data", "Service orientation and customer service", "Java"])).map(skill => skill.name), ["C", "C#", "Java"]);
});

test("full comma-containing labels and empty drafts are compared without losing labels", () => {
  const candidate = skills(["Resilience, flexibility and agility"]);
  assert.deepEqual(pendingResumeSkills({ cv: { sections: { Skills: [{ bullet: candidate[0].name }] } } }, candidate), []);
  assert.deepEqual(pendingResumeSkills(null, candidate), candidate);
});
