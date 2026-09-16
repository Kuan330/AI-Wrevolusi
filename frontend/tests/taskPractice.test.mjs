import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMinutes,
  matchingBaseline,
  trialComparison,
} from "../src/pages/AIExposure/lib/taskPractice.ts";
import {
  saveConfirmedAnalysis,
  saveTaskPractice,
  readUserProfile,
} from "../src/pages/WorkProfile/userProfile.ts";

const trial = {
  id: "one",
  taskWording: "Prepare records",
  workload: "20 records",
  minutes: 20,
  baselineMinutes: 30,
  sameWorkload: true,
  quality: "met",
  createdAt: "2026-09-06T00:00:00Z",
};
test("unknown, zero and invalid times are never treated as a usable baseline", () => {
  for (const value of ["", " ", "0", "-1", "NaN", "Infinity", "100001"])
    assert.equal(parseMinutes(value), null);
  assert.equal(parseMinutes("2.5"), 2.5);
  assert.equal(trialComparison({ ...trial, baselineMinutes: null }), null);
  assert.equal(trialComparison({ ...trial, baselineMinutes: 0 }), null);
  assert.equal(trialComparison({ ...trial, sameWorkload: false }), null);
});
test("comparison handles savings, increases and unchanged timings without assuming improved quality", () => {
  assert.equal(trialComparison(trial).difference, 10);
  assert.equal(trialComparison({ ...trial, minutes: 40 }).difference, -10);
  assert.equal(trialComparison({ ...trial, minutes: 30 }).percentage, 0);
  assert.equal(
    trialComparison({ ...trial, quality: "not_met" }).difference,
    10,
  );
});
test("baselines are reused only for the same task wording and workload", () => {
  const baseline = {
    taskWording: trial.taskWording,
    workload: trial.workload,
    minutes: 30,
  };
  assert.equal(
    matchingBaseline(baseline, trial.taskWording, "20  RECORDS"),
    30,
  );
  assert.equal(
    matchingBaseline(baseline, "Different task", trial.workload),
    null,
  );
  assert.equal(
    matchingBaseline(baseline, trial.taskWording, "40 records"),
    null,
  );
});
test("practice persists to both views without clearing scores; stale edits and occupation changes are rejected", () => {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  globalThis.sessionStorage = { getItem: () => null };
  const task = { id: "task", wording: trial.taskWording, score2025: 0.59 };
  const assessment = { task_id: "task", baseline_score: 0.59 };
  saveConfirmedAnalysis({
    occupationTitle: "Clerk",
    occupationCode: "4110",
    tasks: [task],
    taskExposureAssessments: [assessment],
  });
  saveTaskPractice("4110", "task", trial.taskWording, (current) => ({
    ...current,
    trials: [trial],
  }));
  const profile = readUserProfile();
  assert.deepEqual(
    profile.tasks[0].practice,
    profile.analysis.tasks[0].practice,
  );
  assert.equal(profile.tasks[0].score2025, 0.59);
  assert.deepEqual(profile.analysis.taskExposureAssessments, [assessment]);
  assert.throws(() =>
    saveTaskPractice("other", "task", trial.taskWording, (p) => p),
  );
  assert.throws(() =>
    saveTaskPractice("4110", "task", "Outdated wording", (p) => p),
  );
  saveTaskPractice("4110", "task", trial.taskWording, (current) => ({
    ...current,
    baseline: {
      minutes: 50,
      workload: "50 records",
      taskWording: trial.taskWording,
    },
  }));
  assert.equal(
    readUserProfile().tasks[0].practice.trials[0].baselineMinutes,
    30,
  );
});
