import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { reviewedSourceSkills } from "../src/features/resume/sourceSkills.ts";
import { mergeSkillInputs } from "../src/features/resume/skills.ts";
import { composeCareerInput } from "../src/features/resume/learningRecords.ts";
import { generationNotice } from "../src/features/resume/generationNotice.ts";
import { SKILL_FILTER_VERSION } from "../src/features/resume/types.ts";
import { resumeService } from "../src/features/resume/service.ts";
import { api } from "../src/services/api.ts";

test("three sources deduplicate; every saved course is included without learning-intent extras", async () => {
  const source = readFileSync(new URL("../src/features/resume/skills.ts", import.meta.url), "utf8").replace(/^import .*;\r?$/gm, "");
  const fixture = `
    const resolveCatalogueSkill=(id,ref)=>{const s=ref.find(s=>String(s.wef_skill_id)===String(id));return s?{id:s.wef_skill_id,name:s.core_skill}:null};
    const readLibrary=()=>({saved:["not-started","in-progress","completed"],pending:[{courseId:"not-added"}]});
    const readJourneyState=()=>({review:{decisions:{"1":"accepted","2":"rejected"}},contexts:{},personalSkills:[{id:"sql",name:"sql",decision:"use"},{id:"ignored",name:"Unconfirmed skill",wantsLearning:true}]});
    const isSkillReviewCurrent=()=>true;
    const personalSkillIsCurrent=()=>true;
    const readJourneyProfile=()=>({tasks:[]});
    const readSpecialistState=()=>({entries:[{skillUri:"specialist",skillLabel:"Specialist skill",decision:"use"},{skillUri:"learning",skillLabel:"Specialist learning choice",wantsLearning:true}]});
    const specialistEntryIsCurrent=()=>true;
  `;
  const js = ts.transpileModule(fixture + source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const skills = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  const reference = ["SQL", "Rejected skill", "Creative thinking", "Analytical thinking"].map((core_skill, i) => ({ wef_skill_id: i + 1, core_skill }));
  const directory = new Map([
    ["not-started", { title: "Not started course", skills: ["3"] }],
    ["in-progress", { title: "In progress course", skills: ["1"] }],
    ["completed", { title: "Completed course", skills: ["4"] }],
  ]);
  assert.deepEqual(skills.selectedResumeCourseIds(), [...directory.keys()]);
  const oldResume = reviewedSourceSkills({ redactedText: "Skills\nSQL, Life insurance, C, C++, C#" });
  const inputs = [...skills.resumeSkillInputs(reference, directory), ...oldResume.names.map(name => ({ skill: { id: name, name }, origin: { kind: "reviewed_resume", label: "Old resume", fact_ids: [] } }))];
  const combined = mergeSkillInputs(inputs);
  assert.deepEqual(new Set(combined.skills.map(skill => skill.name)), new Set(["SQL", "Life insurance", "C", "C++", "C#", "Creative thinking", "Analytical thinking", "Specialist skill"]));
  const sql = combined.sources.find(source => source.skill_id === "skill:sql");
  assert.deepEqual(new Set(sql.origins.map(origin => origin.kind)), new Set(["platform_confirmed", "learning_intention", "reviewed_resume"]));
  const record = { id: "practice:other", label: "Standalone goal", kind: "study", text: "Studied another subject.", skillNames: ["Independent learning goal"], fingerprint: "record" };
  const input = composeCareerInput("", inputs, [record], [{ recordId: record.id, text: record.text, reviewed: true, recordFingerprint: record.fingerprint }], value => value);
  assert.deepEqual(input.candidates, combined.skills);
  assert.equal(input.metadata.learning_facts.length, 1);
});

test("current generation requests aggregation and timeout notices preserve all skills", async t => {
  let body;
  t.mock.method(api, "post", async (_url, request) => { body = request; return { sections: [], gaps: [] }; });
  await resumeService.generate("Role", [{ id: "sql", name: "SQL" }], [], false, new AbortController().signal, [], [], "3332", { version: "career_evidence_v2", skill_sources: [], learning_facts: [] }, "reference");
  assert.equal(body.skill_selection, "aggregate");
  assert.equal(SKILL_FILTER_VERSION, "all_sources_v1");
  const notice = generationNotice("source_preserved", ["ai_timeout"], SKILL_FILTER_VERSION);
  assert.match(notice, /Skills are complete/);
  assert.doesNotMatch(notice, /excluded|Only role-related/);
});
