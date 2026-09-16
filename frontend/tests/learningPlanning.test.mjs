import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`;
const planning = await import(
  moduleUrl(
    readFileSync(
      new URL(
        "../src/pages/LearningCentre/lib/coursePlanning.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  )
);
const model = moduleUrl(
  readFileSync(
    new URL("../src/pages/Plan/planModel.ts", import.meta.url),
    "utf8",
  ),
);
const { learningSession } = await import(
  moduleUrl(
    readFileSync(
      new URL(
        "../src/pages/LearningCentre/lib/learningSession.ts",
        import.meta.url,
      ),
      "utf8",
    ).replaceAll("@/pages/Plan/planModel", model),
  )
);
const course = {
  durationMin: 90,
  chapters: [
    { title: "A", min: 30 },
    { title: "B", min: 60 },
  ],
};
test("schedule later needs neither date nor weekdays", () => {
  assert.equal(
    planning.validateChoice(course, planning.defaultChoice(course)),
    null,
  );
});
test("empty chapter selection is rejected", () => {
  assert.ok(
    planning.validateChoice(course, {
      ...planning.defaultChoice(course),
      chapters: [],
    }),
  );
});
test("unknown partial chapter duration remains unknown", () => {
  assert.equal(
    planning.selectedMinutes(
      { ...course, chapters: [{ min: null }, { min: 60 }] },
      { ...planning.defaultChoice(course), chapters: [0] },
    ),
    null,
  );
});
test("routine requires both days and start date", () => {
  const choice = { ...planning.defaultChoice(course), scheduleMode: "routine" };
  assert.ok(planning.validateChoice(course, choice));
  assert.ok(planning.validateChoice(course, { ...choice, weekdays: [0] }));
  assert.equal(
    planning.validateChoice(course, {
      ...choice,
      weekdays: [0],
      startDate: "2026-09-14",
    }),
    null,
  );
});
test("session draft respects next preferred weekday and duration", () => {
  const selection = {
    scheduleMode: "routine",
    startDate: "2026-09-11",
    weekdays: [0],
    minutesPerDay: 45,
  };
  const session = learningSession(
    { id: "course", title: "Course" },
    selection,
    "2026-09-10",
  );
  assert.equal(session.date, "2026-09-14");
  assert.equal(session.start, "18:30");
  assert.equal(session.end, "19:15");
  assert.equal(selection.startDate, "2026-09-11");
});
test("past routine starts use a future preferred day", () => {
  assert.equal(
    learningSession(
      undefined,
      {
        scheduleMode: "routine",
        startDate: "2026-09-01",
        weekdays: [4],
        minutesPerDay: 30,
      },
      "2026-09-10",
    ).date,
    "2026-09-11",
  );
});
