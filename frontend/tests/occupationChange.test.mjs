import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const store = new Map();
const accountStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => {
    store.set(key, value);
  },
  removeItem: (key) => {
    store.delete(key);
  },
};

const source = readFileSync(
  new URL("../src/features/work-profile/userProfile.ts", import.meta.url),
  "utf8",
)
  .replace(
    'import { accountStorage } from "../../services/accountStorage.ts";',
    "const accountStorage = globalThis.__accountStorage;",
  )
  .replace(
    'import type { ProfileTask } from "@/features/work-profile/types";',
    "/** @typedef {{ id: string, wording: string, timeSpent?: string, notes?: string, practice?: { trials: unknown[] } }} ProfileTask */",
  )
  .replace(
    'import type { ConfirmedTaskExposureAssessment } from "@/services/exposureService";',
    "",
  )
  .replace(
    'import type { ReferenceOccupation } from "@/types/reference";',
    "/** @typedef {{ occupation_code: string, title: string, parent_code?: string | null, level?: string }} ReferenceOccupation */",
  );

globalThis.__accountStorage = accountStorage;
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

const unit = (code, title = `Occupation ${code}`) => ({
  occupation_code: code,
  title,
  parent_code: null,
  level: "unit",
});

function seedConfirmedWork() {
  module.saveConfirmedAnalysis({
    occupationTitle: "Software developers",
    occupationPath: ["Professionals", "Software developers"],
    occupationCode: "2512",
    potential25: null,
    meanScore2025: null,
    tasks: [{ id: "t1", wording: "Write code", timeSpent: "", notes: "" }],
    taskExposureAssessments: [],
  });
}

function seedSavedLearning() {
  const records = {
    "aiwrevolusi.learningCentre": JSON.stringify([{ skill_id: 1, added_at: "2026-09-27" }]),
    "aiwrevolusi.learningSkills.v1": JSON.stringify({ version: 2, context: "old work", skills: [{ id: "writing", name: "Writing", source: "custom" }] }),
    "aiwrevolusi.learningResourceSelections.v1": JSON.stringify({ writing: ["course-1"] }),
    "aiwrevolusi.courseLibrary.v1": JSON.stringify({ version: 1, saved: ["course-1"] }),
    "aiwrevolusi.plan.courses.v1": JSON.stringify({ version: 1, courses: [{ id: "course-1", chapters: [{ title: "Start", value: 4 }] }], records: { "2026-09-27": { minutes: 30, studied: true } } }),
    "aiwrevolusi.planner.v1": JSON.stringify({ version: 1, events: [{ id: "event-1", title: "Study", date: "2026-09-28" }] }),
  };
  for (const [key, value] of Object.entries(records)) accountStorage.setItem(key, value);
  return records;
}

function assertLearningUnchanged(records) {
  for (const [key, value] of Object.entries(records)) assert.equal(accountStorage.getItem(key), value, key);
}

test("switching occupation resets role evidence and preserves saved learning for review", () => {
  store.clear();
  seedConfirmedWork();
  accountStorage.setItem(
    "aiwrevolusi.possibilities.chosenDirection",
    JSON.stringify({ occupation_code: "2512" }),
  );
  accountStorage.setItem(
    "aiwrevolusi.possibilities.shortlist",
    JSON.stringify([1, 2]),
  );
  const learning = seedSavedLearning();

  const result = module.beginOccupationChange({
    unit: unit("2221", "Nursing professionals"),
    path: [unit("2221", "Nursing professionals")],
  });

  assert.equal(result.occupationChanged, true);
  assert.equal(module.readConfirmedAnalysis(), null);
  assert.equal(module.readTaskWorkspace(), null);
  assert.equal(
    accountStorage.getItem("aiwrevolusi.possibilities.chosenDirection"),
    null,
  );
  assert.equal(
    accountStorage.getItem("aiwrevolusi.possibilities.shortlist"),
    null,
  );
  assertLearningUnchanged(learning);
  assert.equal(module.readUserProfile().learningReviewNeeded, true);
  assert.equal(accountStorage.getItem("aiwrevolusi.confirmedAnalysis"), null);
  assert.equal(module.readProfileTasks("2221"), null);
  assert.equal(module.readSelectedOccupation()?.unit.occupation_code, "2221");
});

test("re-confirming the same occupation keeps the existing workspace", () => {
  store.clear();
  seedConfirmedWork();
  const learning = seedSavedLearning();
  accountStorage.setItem(
    "aiwrevolusi.possibilities.shortlist",
    JSON.stringify([3]),
  );

  const result = module.beginOccupationChange({
    unit: unit("2512", "Software developers"),
    path: [unit("2512", "Software developers")],
  });

  assert.equal(result.occupationChanged, false);
  assert.equal(module.readConfirmedAnalysis()?.occupationCode, "2512");
  assertLearningUnchanged(learning);
  assert.equal(module.readUserProfile().learningReviewNeeded, false);
  assert.equal(
    accountStorage.getItem("aiwrevolusi.possibilities.shortlist"),
    JSON.stringify([3]),
  );
});

test("editing tasks for the same role clears stale suggestions and preserves learning", () => {
  store.clear();
  seedConfirmedWork();
  const learning = seedSavedLearning();
  accountStorage.setItem("aiwrevolusi.possibilities.chosenDirection", "old direction");

  module.saveProfileTasks("2512", [{ id: "t1", wording: "Review code" }]);

  assert.equal(module.readConfirmedAnalysis(), null);
  assert.equal(accountStorage.getItem("aiwrevolusi.possibilities.chosenDirection"), null);
  assert.equal(module.readUserProfile().learningReviewNeeded, true);
  assertLearningUnchanged(learning);
});

test("practice updates keep role suggestions and do not request a learning review", () => {
  store.clear();
  seedConfirmedWork();
  const learning = seedSavedLearning();
  accountStorage.setItem("aiwrevolusi.possibilities.chosenDirection", "current direction");

  module.saveTaskPractice("2512", "t1", "Write code", () => ({ trials: [{ id: "trial-1" }] }));

  assert.equal(module.readUserProfile().learningReviewNeeded, false);
  assert.equal(accountStorage.getItem("aiwrevolusi.possibilities.chosenDirection"), "current direction");
  assertLearningUnchanged(learning);
});

test("switching a legacy profile still marks saved learning for review", () => {
  store.clear();
  seedConfirmedWork();
  accountStorage.removeItem("aiwrevolusi.userProfile");
  const learning = seedSavedLearning();

  module.beginOccupationChange({ unit: unit("2221"), path: [unit("2221")] });

  assert.equal(module.readUserProfile().learningReviewNeeded, true);
  assert.equal(module.readConfirmedAnalysis(), null);
  assertLearningUnchanged(learning);
});
