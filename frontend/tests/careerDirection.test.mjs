import test from "node:test";
import assert from "node:assert/strict";
import { readCareerDirection, saveCareerDirection, DIRECTION_KEY } from "../src/services/careerDirection.ts";
import { activateWorkspace, flushWorkspace } from "../src/services/accountStorage.ts";
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
globalThis.window = new EventTarget();
test("selected career direction is isolated by account and retains existing skill path metadata", () => {
  activateWorkspace("target-one", { data: {}, revision: 0 });
  const role = { occupation_code: "2421", title: "Management and Organization Analysts", skill_id: 1, skillSources: { 1: "Original direction" } };
  saveCareerDirection(role); assert.deepEqual(readCareerDirection(), role);
  activateWorkspace("target-two", { data: {}, revision: 0 }); assert.equal(readCareerDirection(), null);
  activateWorkspace(null);
});
test("corrupt or invalid selection asks the user to reselect instead of creating a role", () => {
  activateWorkspace(null);
  for (const invalid of ["{broken", JSON.stringify({ title: "No code" }), JSON.stringify({ occupation_code: "  " }), JSON.stringify({ occupation_code: 2421 })]) {
    memory.set(DIRECTION_KEY, invalid); assert.throws(readCareerDirection, /Choose a career direction again/);
  }
  memory.delete(DIRECTION_KEY); assert.equal(readCareerDirection(), null);
});
test("selection sync failure does not erase the saved choice and propagates to navigation", async () => {
  activateWorkspace("target-conflict", { data: {}, revision: 0 });
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: "Synthetic failed selection save" }), { status: 409, headers: { "content-type": "application/json" } });
  saveCareerDirection({ occupation_code: "2421" });
  await assert.rejects(flushWorkspace(), /Synthetic failed selection save/);
  assert.equal(readCareerDirection().occupation_code, "2421");
  activateWorkspace(null);
});
