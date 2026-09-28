import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText,
).toString("base64")}`;
const routes = moduleUrl(readFileSync(new URL("../src/constants/routes.ts", import.meta.url), "utf8"));
const { getJourneyArea, getWorkStepStatus, PRIMARY_NAV_MENU, WORK_NAV_MENU, LEARNING_NAV_MENU } = await import(
  moduleUrl(readFileSync(new URL("../src/constants/menu.ts", import.meta.url), "utf8")
    .replaceAll("@/constants/routes", routes)),
);

test("every work page stays in the same global area, including task and skill links", () => {
  for (const path of ["/profile", "/profile/tasks", "/profile/tasks/example", "/ai-exposure", "/skills", "/work-profile"]) {
    assert.equal(getJourneyArea(path), "work", path);
  }
});

test("learning and career areas are separate and do not match unrelated prefixes", () => {
  assert.equal(getJourneyArea("/plan"), "learning");
  assert.equal(getJourneyArea("/learning-centre"), "learning");
  assert.equal(getJourneyArea("/possibilities"), "careers");
  assert.equal(getJourneyArea("/profile-other"), undefined);
  assert.equal(getJourneyArea("/continue"), undefined);
});

test("global and local links remain available before confirmation", () => {
  assert.deepEqual(PRIMARY_NAV_MENU.map(({ label }) => label), ["My Work", "My Learning", "Career Options"]);
  assert.deepEqual(WORK_NAV_MENU.map(({ path }) => path), ["/profile", "/profile/tasks", "/ai-exposure", "/skills"]);
  assert.deepEqual(LEARNING_NAV_MENU.map(({ path }) => path), ["/plan", "/learning-centre"]);
  const pending = { workConfirmed: false, assessmentChecked: false, skillsReviewed: false };
  for (const { key } of WORK_NAV_MENU) assert.equal(getWorkStepStatus(key, pending), undefined);
});

test("a checked assessment can complete the check without a reliable exposure score", () => {
  const state = { workConfirmed: true, assessmentChecked: true, skillsReviewed: false };
  assert.equal(getWorkStepStatus("details", state), "Confirmed");
  assert.equal(getWorkStepStatus("tasks", state), "Confirmed");
  assert.equal(getWorkStepStatus("findings", state), "Checked");
  assert.equal(getWorkStepStatus("skills", state), undefined);
});

test("skill review completion depends on a saved current review, not an assessment", () => {
  const state = { workConfirmed: true, assessmentChecked: true, skillsReviewed: true };
  assert.equal(getWorkStepStatus("skills", state), "Reviewed");
  assert.equal(getWorkStepStatus("skills", { ...state, skillsReviewed: false }), undefined);
});
