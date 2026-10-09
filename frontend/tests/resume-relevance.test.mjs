import test from "node:test";
import assert from "node:assert/strict";
import { applySections, documentYaml, parseResumeYaml } from "../src/features/resume/document.ts";
import { appliedSkillFilter, invalidateEditedSkills } from "../src/features/resume/skillFilter.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { emptyDraft, SKILL_FILTER_VERSION } from "../src/features/resume/types.ts";
import { parseResumeRecord } from "../src/features/resume/repository.ts";
import { generationNotice } from "../src/features/resume/generationNotice.ts";
import { resumeService } from "../src/features/resume/service.ts";
import { api } from "../src/services/api.ts";
const original = {cv: {sections: {Skills: [{bullet: "Life insurance"}], Experience: ["Reviewed original experience"], Projects: [{name: "Original project", date: "Apr 2026", highlights: ["Cleaned 2,400 records."]}]}}, design: {theme: "engineeringresumes"}};
const emptySkills = [{title: "Skills", entries: []}];
const record = () => ({...emptyDraft("owner"), revision: 1, updatedAt: "2026-10-10T00:00:00Z", document: structuredClone(original), yamlText: documentYaml(original)});
test("role-filtered empty Skills removes only that chapter, without mutating the source", () => {
  const before = structuredClone(original);
  const next = applySections(original, emptySkills, undefined, SKILL_FILTER_VERSION);
  assert.equal(next.cv.sections.Skills, undefined);
  assert.deepEqual(next.cv.sections.Experience, original.cv.sections.Experience);
  assert.deepEqual(next.cv.sections.Projects, original.cv.sections.Projects);
  assert.deepEqual(original, before);
  assert.equal(parseResumeYaml(documentYaml(next)).error, "");
});
test("legacy empty Skills and unselected Skills retain old behavior", () => {
  assert.deepEqual(applySections(original, emptySkills).cv.sections.Skills, []);
  assert.deepEqual(applySections(original, [{title: "Experience", entries: [{text: "Reviewed original experience", verbatim: true, skill_ids: [], fact_ids: ["f1"]}]}], undefined, SKILL_FILTER_VERSION).cv.sections.Skills, original.cv.sections.Skills);
});
test("filter metadata only comes from a verified new-generation result", () => {
  assert.deepEqual(appliedSkillFilter({sections: [], gaps: [], skill_filter_version: SKILL_FILTER_VERSION}, "current"), {skillFilterVersion: SKILL_FILTER_VERSION, skillFilterInputFingerprint: "current"});
  assert.deepEqual(appliedSkillFilter({sections: [], gaps: []}, "old"), {skillFilterVersion: undefined, skillFilterInputFingerprint: undefined});
});
test("manual Skills edits invalidate proof; edits outside Skills do not", () => {
  const before = {...record(), skillFilterVersion: SKILL_FILTER_VERSION, skillFilterInputFingerprint: "current"};
  const changed = {...before, document: structuredClone(before.document)};
  changed.document.cv.sections.Skills.push({bullet: "Unreviewed addition"});
  assert.equal(invalidateEditedSkills(before, changed).skillFilterVersion, undefined);
  assert.equal(invalidateEditedSkills(before, changed).skillFilterInputFingerprint, undefined);
  const outside = {...before, document: structuredClone(before.document)};
  outside.document.cv.name = "Local contact";
  assert.equal(invalidateEditedSkills(before, outside).skillFilterVersion, SKILL_FILTER_VERSION);
});
test("apply, undo and redo preserve filter metadata without changing the pending target", () => {
  const before = {...record(), pendingJobRequirements: "New pending target"};
  const after = {...before, document: applySections(before.document, emptySkills, undefined, SKILL_FILTER_VERSION), ...appliedSkillFilter({sections: emptySkills, gaps: [], skill_filter_version: SKILL_FILTER_VERSION}, "input-v1")};
  const history = createEditorHistory();history.record(before, after);
  const undo = history.undo();assert.deepEqual(undo.document, before.document);assert.equal(undo.skillFilterVersion, undefined);assert.equal(undo.pendingJobRequirements, undefined);
  const redo = history.redo();assert.equal(redo.skillFilterVersion, SKILL_FILTER_VERSION);assert.equal(redo.skillFilterInputFingerprint, "input-v1");assert.equal(redo.document.cv.sections.Skills, undefined);
});
test("old drafts are readable and optional filter metadata roundtrips", () => {
  const old = record();assert.deepEqual(parseResumeRecord(old, "owner"), old);
  const next = {...record(), skillFilterVersion: SKILL_FILTER_VERSION, skillFilterInputFingerprint: "input-v1"};
  next.previous = {document: structuredClone(original), yamlText: documentYaml(original), jobRequirements: "Old target", skillFilterVersion: SKILL_FILTER_VERSION, skillFilterInputFingerprint: "old-input"};
  next.proposal = {sections: emptySkills, gaps: [], jobRequirements: "New target", skill_filter_version: SKILL_FILTER_VERSION, outcome: "tailored", notices: ["no_related_skills"]};
  assert.deepEqual(parseResumeRecord(next, "owner"), next);
  assert.throws(()=>parseResumeRecord({...next, skillFilterVersion: "unknown"}, "owner"));
  assert.throws(()=>parseResumeRecord({...next, previous: {...next.previous, skillFilterInputFingerprint: 42}}, "owner"));
});
test("relevance fallback and zero-match notices never claim all skills were included", () => {
  const fallback = generationNotice("source_preserved", ["ai_timeout", "skill_relevance_incomplete"], SKILL_FILTER_VERSION);
  assert.match(fallback, /not confirmed as related were excluded/);assert.doesNotMatch(fallback, /Skills are complete/);
  assert.match(generationNotice("tailored", ["no_related_skills"], SKILL_FILTER_VERSION), /no Skills section/);
  assert.match(generationNotice("source_preserved", ["ai_timeout"]), /Skills are complete/);
});
test("new requests send occupation code and keep the 70-second budget; legacy calls still work", async t => {
  const calls = [];
  t.mock.method(api, "post", async (...args)=>{calls.push(args);return {sections: [], gaps: []};});
  const signal = new AbortController().signal;
  await resumeService.generate("Role", [{id: "s", name: "SQL"}], [], true, signal, [], [], "2421");
  assert.equal(calls[0][1].occupation_code, "2421");assert.equal(calls[0][2], 70000);
  assert.deepEqual(calls[0][1].skills, [{id: "s", name: "SQL"}]);
  await resumeService.generate("Legacy", [], [], true, signal);
  assert.equal(calls[1][1].occupation_code, undefined);assert.equal(calls[1][2], 55000);
});
