import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applySections, documentYaml, parseResumeYaml } from "../src/features/resume/document.ts";
const file = path => readFileSync(new URL(path, import.meta.url), "utf8");
for (const count of [1, 80, 81, 250]) {
  test(`${count} generated skills apply and roundtrip as separate bullet entries`, () => {
    const entries = Array.from({length: count}, (_, i) => ({text: i === 0 ? "Reading, writing and mathematics" : `Skill ${i}`, skill_ids: [`s${i}`], fact_ids: []}));
    const original = {cv: {sections: {Skills: [{bullet: "Old, joined list"}], Projects: [{name: "Original project", date: "Apr 2026", highlights: ["Reviewed 180 responses."]}]}}, design: {theme: "engineeringresumes"}};
    const before = structuredClone(original);
    const next = applySections(original, [{title: "Skills", entries}]);
    assert.deepEqual(original, before);
    assert.deepEqual(next.cv.sections.Skills, entries.map(e => ({bullet: e.text})));
    assert.deepEqual(next.cv.sections.Projects, before.cv.sections.Projects);
    const parsed = parseResumeYaml(documentYaml(next));
    assert.equal(parsed.error, "");
    assert.deepEqual(parsed.document.cv.sections.Skills, next.cv.sections.Skills);
  });
}
test("modern generation gets 70 seconds; legacy, assistant and rendering budgets stay unchanged", () => {
  const source = file("../src/features/resume/service.ts");
  assert.match(source, /sections \? 70000 : 55000/);
  assert.match(source, /context_reviewed: true }, 55000, signal/);
  assert.match(source, /setTimeout\(relay, 35000\)/);
});
test("generation progress is indeterminate, accessible and has reduced-motion styling", () => {
  const component = file("../src/pages/ResumeBuilder/ResumeGenerationProgress.tsx");
  const page = file("../src/pages/ResumeBuilder/ResumeBuilder.tsx");
  const css = file("../src/pages/ResumeBuilder/resume-builder.css");
  assert.match(component, /role="progressbar" aria-label="Tailoring your resume"/);
  assert.match(component, /role="status" aria-live="polite">Tailoring your resume/);
  assert.match(component, /rb-generation-elapsed" aria-hidden="true"/);
  assert.doesNotMatch(component, /aria-valuenow|aria-valuetext/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(page, /<ResumeGenerationProgress seconds={generationSeconds}/);
  assert.doesNotMatch(page, /Polishing reviewed facts|cannot finish within 30 seconds/);
});
