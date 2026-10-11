import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completedResumeCourse, resumeLearningRecords, composeCareerInput } from "../src/features/resume/learningRecords.ts";
import { mergeSkillInputs } from "../src/features/resume/skills.ts";
import { appliedCareerAlignment, careerAlignmentNeedsReview } from "../src/features/resume/careerAlignment.ts";
import { invalidateEditedSkills } from "../src/features/resume/skillFilter.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { parseResumeRecord } from "../src/features/resume/repository.ts";
import { applySections } from "../src/features/resume/document.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
const course = { id: "course-1", title: "Data tools", provider: "Synthetic catalogue", skills: ["analytical-thinking"], chapters: [{ title: "A" }, { title: "B" }], catalogueChaptersComplete: true };
const progress = [0, 1].map(chapter_index => ({ course_id: course.id, skill_id: course.skills[0], chapter_index, value: 10 }));
const directory = new Map([[course.id, course]]);
const record = () => resumeLearningRecords(directory, progress, [], () => ["Analytical thinking"])[0];
const selection = (row = record()) => ({ recordId: row.id, text: row.text, reviewed: true, recordFingerprint: row.fingerprint });
const baseSkills = [{ skill: { id: "a", name: "Analytical thinking" }, origin: { kind: "platform_confirmed", label: "User confirmed", fact_ids: [] } }];
const alignment = { occupation_code: "2421", title: "Management and Organisation Analysts", requirements: [{ skill_id: 1, name: "Analytical thinking" }, { skill_id: 2, name: "Leadership" }], links: [{ skill_id: "a", name: "Analytical thinking", requirement_skill_id: 1, method: "standard_mapping", origins: [baseSkills[0].origin], examples: [{ fact_id: "f1", text: "Used SQL joins.", kind: "resume" }], locations: [{ section: "Skills", entry_index: 0 }, { section: "Projects", entry_index: 1 }] }], summary_fact_ids: ["f1"], project_order: ["p1"] };
const generation = { tailoring_version: "career_evidence_v1", role_alignment: alignment, skill_filter_version: "role_relevance_v1", sections: [{ title: "Skills", entries: [{ text: "Analytical thinking", skill_ids: ["a"], fact_ids: [] }] }], gaps: [] };

test("completion requires complete catalogue chapters and EVERY synchronised 10/10 row", () => {
  assert.equal(completedResumeCourse(course, progress), true);
  for (const bad of [[], [progress[0]], [progress[0], { ...progress[1], value: 9 }], [progress[0], progress[0]], [...progress, { ...progress[1], chapter_index: 3 }], progress.map(row => ({ ...row, skill_id: "wrong" })), [...progress, { ...progress[0], skill_id: "wrong", value: 1 }]]) assert.equal(completedResumeCourse(course, bad), false);
  for (const changed of [{ ...course, chapters: null }, { ...course, catalogueChaptersComplete: false }, { ...course, catalogueChaptersComplete: undefined }, { ...course, chapters: [] }]) assert.equal(completedResumeCourse(changed, progress), false);
});
test("local pending progress cannot certify completion", () => {
  assert.equal(completedResumeCourse(course, [{ ...progress[0], value: 3 }, progress[1]]), false);
  const rows = resumeLearningRecords(directory, [{ ...progress[0], value: 3 }, progress[1]], [], () => ["Analytical thinking"]);
  assert.deepEqual(rows, []);
});
test("completed records retain self-recorded nature and do not infer a date", () => {
  const row = record(); assert.equal(row.kind, "course_completion");
  assert.ok(row.text.includes("not external certification")); assert.ok(!/\b2026\b|certificate earned|proficient/i.test(row.text));
  assert.deepEqual(row.skillNames, ["Analytical thinking"]);
});
test("practice remains study/course/workplace practice, canonical names never course titles", () => {
  const goals = [{ id: "g", initial: { skill: { label: "Old course alias" } }, attempts: ["study", "course_practice", "workplace_practice"].map((type, i) => ({ id: String(i), type, date: "2026-09-20", description: "Used SQL joins on a synthetic dataset.", notes: "Confidential extra notes" })) }];
  const records = resumeLearningRecords(new Map(), [], goals, () => [], () => ["SQL"]);
  assert.deepEqual(records.map(row => row.kind), ["study", "course_practice", "workplace_practice"]);
  assert.ok(records.every(row => row.skillNames[0] === "SQL" && !row.text.includes("Confidential")));
});
test("selecting a learning record alone does not make it generation evidence", () => {
  const row = record();
  assert.throws(() => composeCareerInput("", baseSkills, [row], [{ ...selection(row), reviewed: false }], text => text), /Review/);
  assert.equal(composeCareerInput("", baseSkills, [row], [], text => text).evidence.length, 0);
});
test("reviewed learning uses exact separate source section and deduplicates origins", () => {
  const row = record(); const input = composeCareerInput("Skills\nAnalytical thinking\nProfessional Experience\n• Reviewed 180 responses.", baseSkills, [row], [selection(row)], text => text);
  assert.equal(input.candidates.length, 1); assert.equal(input.metadata.version, "career_evidence_v1");
  assert.deepEqual(input.metadata.skill_sources[0].origins.map(origin => origin.kind), ["platform_confirmed", "reviewed_learning"]);
  assert.equal(input.sections.at(-1).title, "Professional Development");
  const learning = input.metadata.learning_facts[0]; assert.equal(learning.kind, "course_completion");
  assert.ok(input.evidence.find(fact => fact.id === learning.fact_id).text.startsWith("Self-recorded course completion:"));
  assert.ok(!input.candidates.some(skill => skill.name === course.title));
  assert.deepEqual(input.projects, []);
});
test("a reviewed selected record can contribute its associated skill without a saved course", () => {
  const row = record(); const input = composeCareerInput("", [], [row], [selection(row)], text => text);
  assert.deepEqual(input.candidates.map(skill => skill.name), ["Analytical thinking"]);
});
test("learning descriptions are redacted before evidence composition", () => {
  const row = record(); const input = composeCareerInput("", baseSkills, [row], [{ ...selection(row), text: "Private Name used data tools." }], text => text.replaceAll("Private Name", "[REDACTED]"));
  assert.ok(!JSON.stringify(input.evidence).includes("Private Name"));
});
for (const variant of ["missing", "changed", "empty", "heading", "too long"]) test(`invalid selected learning is visible, not silently dropped: ${variant}`, () => {
  const row = record(); const choice = selection(row);
  const records = variant === "missing" ? [] : variant === "changed" ? [{ ...row, fingerprint: "new-source" }] : [row];
  if (variant === "empty") choice.text = " ";
  if (variant === "heading") choice.text = "Projects\nInvented project";
  if (variant === "too long") choice.text = "x".repeat(1701);
  assert.throws(() => composeCareerInput("", baseSkills, records, [choice], text => text));
});
test("all four provenance sources deduplicate names while preserving origins", () => {
  const inputs = ["reviewed_resume", "platform_confirmed", "learning_intention", "reviewed_learning"].map(kind => ({ skill: { id: kind, name: " SQL " }, origin: { kind, label: kind, fact_ids: [] } }));
  const merged = mergeSkillInputs(inputs); assert.equal(merged.skills.length, 1); assert.equal(merged.sources[0].origins.length, 4);
  assert.equal(merged.skills[0].name, "SQL");
});
test("source overflow reports an error without truncating the candidates", () => {
  assert.throws(() => mergeSkillInputs(Array.from({ length: 21 }, (_, index) => ({ skill: { id: "sql", name: "SQL" }, origin: { kind: "learning_intention", label: String(index), fact_ids: [] } }))), /limit/);
});
test("partial application exposes only actual applied locations", () => {
  const document = applySections(null, generation.sections);
  const applied = appliedCareerAlignment(generation, document, ["Skills"]);
  assert.deepEqual(applied.alignment.links[0].locations, [{ section: "Skills", entry_index: 0 }]);
  assert.deepEqual(applied.alignment.summary_fact_ids, []); assert.deepEqual(applied.alignment.project_order, []);
  assert.equal(careerAlignmentNeedsReview(applied, document), false);
  assert.deepEqual(alignment.links[0].locations.length, 2);
});
test("manual/assistant content edits invalidate alignment and Undo/Redo restore exact proofs", () => {
  const document = applySections(null, generation.sections); const before = { ...emptyDraft("a"), document, careerAlignment: appliedCareerAlignment(generation, document, ["Skills"]) };
  const changed = { ...document, cv: { ...document.cv, sections: { ...document.cv.sections, Skills: [{ bullet: "SQL" }] } } };
  const after = invalidateEditedSkills(before, { ...before, document: changed });
  assert.equal(after.careerAlignment.needsReview, true);
  const history = createEditorHistory(); history.record(before, after); assert.deepEqual(history.undo().careerAlignment, before.careerAlignment); assert.deepEqual(history.redo().careerAlignment, after.careerAlignment);
});
test("legacy drafts remain readable; malformed new metadata and other accounts fail closed", () => {
  const legacy = { ...emptyDraft("a"), revision: 1 }; assert.equal(parseResumeRecord(legacy, "a"), legacy);
  const document = applySections(null, generation.sections); const current = { ...legacy, document, careerAlignment: appliedCareerAlignment(generation, document, ["Skills"]), learningSelections: [selection()] };
  assert.equal(parseResumeRecord(current, "a"), current);
  assert.throws(() => parseResumeRecord(current, "b"), /not been overwritten/);
  assert.throws(() => parseResumeRecord({ ...current, careerAlignment: { alignment: {} } }, "a"), /not been overwritten/);
  assert.throws(() => parseResumeRecord({ ...current, learningSelections: [{}] }, "a"), /not been overwritten/);
  assert.throws(() => parseResumeRecord({ ...current, learningSelections: [null] }, "a"), /not been overwritten/);
  assert.throws(() => parseResumeRecord({ ...current, previous: undefined }, "a"), /not been overwritten/);
});
test("new flow preserves budgets and invalidates old unapplied suggestions without old preview", () => {
  const builder = readFileSync(new URL("../src/pages/ResumeBuilder/ResumeBuilder.tsx", import.meta.url), "utf8");
  assert.ok(builder.includes("draft.proposal.tailoring_version !== TAILORING_VERSION"));
  assert.ok(!builder.includes("Skills included in your resume"));
  const service = readFileSync(new URL("../src/features/resume/service.ts", import.meta.url), "utf8");
  assert.ok(service.includes("source_metadata: metadata")); assert.ok(service.includes("70000")); assert.ok(service.includes("100000"));
});

test("completion checks every mapped learning scope without rejecting complete multi-skill records", () => {
  const mapped = { ...course, skills: [...course.skills, "programming"] };
  const rows = [...progress, ...progress.map(row => ({ ...row, skill_id: "programming" }))];
  assert.equal(completedResumeCourse(mapped, rows), true);
  assert.equal(completedResumeCourse(mapped, [...progress, { ...rows[2], value: 9 }]), false);
});

test("incomplete career presentation explains which original content was retained", async () => {
  const { generationNotice } = await import("../src/features/resume/generationNotice.ts");
  const note = generationNotice("source_preserved", ["career_summary_unavailable", "project_order_unverified", "alignment_incomplete"], "role_relevance_v1");
  assert.match(note, /original summary was retained/);
  assert.match(note, /original project order was retained/);
  assert.match(note, /omitted from the explanation/);
});
