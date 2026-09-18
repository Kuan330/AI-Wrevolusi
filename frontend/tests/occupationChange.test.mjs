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
  new URL("../src/pages/WorkProfile/userProfile.ts", import.meta.url),
  "utf8",
)
  .replace(
    'import { accountStorage } from "../../services/accountStorage.ts";',
    "const accountStorage = globalThis.__accountStorage;",
  )
  .replace(
    'import type { ProfileTask } from "@/pages/WorkProfile/types";',
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

test("switching occupation clears analysis and derived journey data", () => {
  store.clear();
  module.saveConfirmedAnalysis({
    occupationTitle: "Software developers",
    occupationPath: ["Professionals", "Software developers"],
    occupationCode: "2512",
    potential25: null,
    meanScore2025: null,
    tasks: [{ id: "t1", wording: "Write code", timeSpent: "", notes: "" }],
    taskExposureAssessments: [],
  });
  accountStorage.setItem(
    "aiwrevolusi.possibilities.chosenDirection",
    JSON.stringify({ occupation_code: "2512" }),
  );
  accountStorage.setItem(
    "aiwrevolusi.possibilities.shortlist",
    JSON.stringify([1, 2]),
  );
  accountStorage.setItem(
    "aiwrevolusi.learningSkills.v1",
    JSON.stringify({ version: 2, context: "x", skills: [] }),
  );
  accountStorage.setItem("aiwrevolusi.planner.v1", "{}");

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
  assert.equal(accountStorage.getItem("aiwrevolusi.learningSkills.v1"), null);
  assert.equal(accountStorage.getItem("aiwrevolusi.planner.v1"), null);
  assert.equal(module.readSelectedOccupation()?.unit.occupation_code, "2221");
});

test("re-confirming the same occupation keeps the existing workspace", () => {
  store.clear();
  module.saveConfirmedAnalysis({
    occupationTitle: "Software developers",
    occupationPath: ["Professionals", "Software developers"],
    occupationCode: "2512",
    potential25: null,
    meanScore2025: null,
    tasks: [{ id: "t1", wording: "Write code", timeSpent: "", notes: "" }],
    taskExposureAssessments: [],
  });
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
  assert.equal(
    accountStorage.getItem("aiwrevolusi.possibilities.shortlist"),
    JSON.stringify([3]),
  );
});
