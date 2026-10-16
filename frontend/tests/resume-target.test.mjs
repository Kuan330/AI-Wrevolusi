import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interviewResumeRequirements, targetRequirements, validTargetRole, withTargetRole } from "../src/features/resume/targetRole.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
import { parseResumeRecord } from "../src/features/resume/repository.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { prepareInterviewContext } from "../src/features/interview/resumeItems.ts";
import { planBody } from "../src/features/interview/start.ts";
import { createSession } from "../src/features/interview/session.ts";

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
test("a new source-preserved resume can practise for its selected role without a tailored mark", () => {
  const saved = { ...withTargetRole(emptyDraft("a"), role), revision: 1, document: { cv: { name: "Aisyah", email: "aisyah@example.test", sections: { Experience: [{ company: "Aurora", position: "Analyst", highlights: ["Prepared weekly reports."] }] } } }, generationOutcome: "source_preserved", generationNotices: ["ai_timeout"], generationInputFingerprint: "reviewed-input" };
  const restored = parseResumeRecord(structuredClone(saved), "a");
  const requirements = interviewResumeRequirements(restored);
  const context = prepareInterviewContext(restored.document, requirements, "Aurora");
  assert.equal(context.roleTitle, role.title);
  assert.ok(context.display.some(item => item.kind === "work"));
  assert.ok(context.display.some(item => item.kind === "requirement"));
  assert.doesNotMatch(JSON.stringify(planBody(context, [], [], true)), /Aisyah|aisyah@example.test|Aurora/);
  assert.equal(planBody(context, [], [], false).items_reviewed, false, "the target does not bypass consent");
  const session = createSession({ mode: "resume", role: { title: context.roleTitle, sentTitle: context.sentRoleTitle, requirements }, resumeVersion: { savedAt: "2026-10-16T00:00:00Z", itemCount: context.display.length }, items: context.display, plan: { source: "ai", questions: [{ text: "What did you do?", kind: "resume_item", item_id: context.display[0].id, topic_id: null, bank_id: null }] } });
  assert.equal(session.role.requirements, targetRequirements(role));
  assert.equal(restored.jobRequirements, "");
  assert.equal(restored.generationOutcome, "source_preserved");
  assert.equal(restored.generationInputFingerprint, "reviewed-input");
  assert.equal(restored.careerAlignment, undefined);
});
test("changing a fallback practice target keeps the saved content and tailoring evidence intact", () => {
  const before = { ...withTargetRole(emptyDraft("a"), role), document: generated.document, generationOutcome: "source_preserved", generationInputFingerprint: "original-input" };
  const nextRole = { ...role, occupation_code: "2512", title: "Software developers" };
  const after = withTargetRole(before, nextRole);
  assert.equal(prepareInterviewContext(after.document, interviewResumeRequirements(after)).roleTitle, nextRole.title);
  assert.equal(after.document, before.document);
  assert.equal(after.jobRequirements, "");
  assert.equal(after.generationOutcome, "source_preserved");
  assert.equal(after.generationInputFingerprint, "original-input");
  assert.equal(interviewResumeRequirements(withTargetRole(after, null)), "");
});
test("legacy and already tailored resumes retain their applied interview role after a target change", () => {
  for (const saved of [generated, { ...generated, generationOutcome: "tailored" }]) {
    const restored = parseResumeRecord(structuredClone(saved), "a");
    const changed = withTargetRole(restored, role);
    assert.equal(interviewResumeRequirements(changed), saved.jobRequirements);
    assert.equal(prepareInterviewContext(changed.document, interviewResumeRequirements(changed)).roleTitle, "Data Analyst");
  }
  const legacyPending = { ...emptyDraft("a"), document: generated.document, pendingJobRequirements: "Unapplied legacy role" };
  assert.equal(interviewResumeRequirements(legacyPending), "", "unapplied free text is not a confirmed target");
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
