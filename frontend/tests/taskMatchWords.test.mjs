import test from "node:test";
import assert from "node:assert/strict";
import {
  countTaskMatchWords,
  hasMinimumTaskMatchWords,
  MIN_TASK_MATCH_WORDS,
} from "../src/pages/WorkProfile/taskMatchWords.ts";

// The examples below are shared with the backend suite
// (backend/tests/test_ai_task_match.py) so the two counting rules cannot
// drift apart without failing a test on one side.
test("counts meaningful words with the shared backend rule", () => {
  const cases = [
    ["", 0],
    ["   ...  ", 0],
    ["the and of", 0],
    ["shop supervisor", 2],
    ["Managing a small team of staff", 4],
    ["manage shifts and tasks", 3],
    ["I manage the shop", 3],
    ["Open the store, serve customers, and close registers", 6],
    ["负责管理团队排班并跟进客户投诉处理", 1],
    ["管理 team 的任务", 3],
  ];

  for (const [value, expected] of cases) {
    assert.equal(countTaskMatchWords(value), expected, value);
  }
});

test("automatic matching only starts from five meaningful words", () => {
  assert.equal(MIN_TASK_MATCH_WORDS, 5);
  assert.equal(hasMinimumTaskMatchWords("Prepare a report"), false);
  assert.equal(hasMinimumTaskMatchWords("Repair satellites in deep space"), false);
  assert.equal(
    hasMinimumTaskMatchWords("Prepare weekly sales report data"),
    true,
  );
});
