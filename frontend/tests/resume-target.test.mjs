import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { targetRequirements, validTargetRole, withTargetRole } from "../src/features/resume/targetRole.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
import { parseResumeRecord } from "../src/features/resume/repository.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { prepareInterviewContext } from "../src/features/interview/resumeItems.ts";

const role = { occupation_code: "2421", title: "Management and Organization Analysts", skills: [
  { skill_id: 1, skill_slug: "analytical-thinking", name: "Analytical thinking" },
  { skill_id: 2, skill_slug: "leadership", name: "Leadership" },
] };
const generated = { ...emptyDraft("a"), revision: 1, document: { cv: { sections: { Skills: ["SQL"] } } }, jobRequirements: "Data Analyst\n- SQL", pendingJobRequirements: "Legacy user input", source: null };
test("all database skills become requirements with the role name first, never user abilities", () => {
  assert.equal(targetRequirements(role), "Management and Organization Analysts\nRequired skills:\n- Analytical thinking\n- Leadership");
  const next = withTargetRole(generated, role);
  assert.deepEqual(next.document, generated.document); assert.equal(next.jobRequirements, generated.jobRequirements);
  assert.equal(next.source, generated.source); assert.deepEqual(next.gaps, generated.gaps);
  assert.equal(next.legacyPendingJobRequirements, "Legacy user input");
  assert.equal(prepareInterviewContext(next.document, next.jobRequirements).roleTitle, "Data Analyst");
});
test("target switches discard stale proposals but keep applied resume and previous snapshots", () => {
  const before = { ...withTargetRole(generated, role), proposal: { sections: [], gaps: [], jobRequirements: targetRequirements(role) }, previous: { document: generated.document, yamlText: "old", jobRequirements: "Old role" } };
  const next = withTargetRole(before, { ...role, occupation_code: "2512", title: "Software developers" });
  assert.equal(next.proposal, null); assert.equal(next.document, before.document); assert.equal(next.previous, before.previous);
  assert.equal(next.jobRequirements, before.jobRequirements);
  assert.equal(withTargetRole(next, next.targetRole), next, "No repeated local writes for unchanged target");
});
test("missing or empty targets block requirements without destroying existing documents", () => {
  assert.equal(targetRequirements({ ...role, skills: [] }), "");
  const next = withTargetRole(generated, null);
  assert.equal(next.pendingJobRequirements, ""); assert.equal(next.jobRequirements, generated.jobRequirements);
  assert.equal(next.document, generated.document);
});
test("old drafts read unchanged and new optional metadata is validated", () => {
  assert.equal(parseResumeRecord(generated, "a"), generated);
  const next = withTargetRole(generated, role);
  assert.equal(parseResumeRecord(next, "a").targetRole, role);
  assert.throws(() => parseResumeRecord({ ...next, targetRole: { ...role, skills: [{ skill_id: "1" }] } }, "a"), /not been overwritten/);
  assert.equal(validTargetRole({ ...role, skills: [role.skills[0], role.skills[0]] }), false);
  assert.equal(validTargetRole({ ...role, occupation_code: "" }), false);
});
test("undo restores applied content and target but not the selected role or pending requirements", () => {
  const before = withTargetRole(generated, role), after = { ...before, jobRequirements: targetRequirements(role), yamlText: "new" };
  const history = createEditorHistory(); history.record(before, after);
  const current = withTargetRole(after, { ...role, title: "New target" });
  const restored = { ...current, ...history.undo() };
  assert.equal(restored.jobRequirements, generated.jobRequirements);
  assert.equal(restored.targetRole.title, "New target");
  assert.equal(restored.pendingJobRequirements, targetRequirements(current.targetRole));
});
test("UI has no manual target input or example and keeps requests account/target scoped", () => {
  const page = readFileSync(new URL("../src/pages/ResumeBuilder/ResumeBuilder.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /EXAMPLE_JOB_REQUIREMENTS|setShowExample|placeholder="Paste the role/);
  assert.match(page, /targetIsCurrent/); assert.match(page, /targetVersion.current !== capturedTarget/);
  assert.match(page, /generationRequest.current.abort/); assert.match(page, /withTargetRole/);
});
