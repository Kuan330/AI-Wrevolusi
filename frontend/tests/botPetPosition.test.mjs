import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/common/botPetPosition.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { clampPetPosition } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const mobile = { viewportWidth: 390, viewportHeight: 844, petWidth: 96, petHeight: 104, navigationBottom: 178 };

test("restoring the reported top-right mobile position cannot cover navigation", () => {
  assert.deepEqual(clampPetPosition({ x: 222, y: 0 }, mobile), { x: 222, y: 186 });
});

test("a desktop saved position is clamped after resizing to a mobile viewport", () => {
  const next = clampPetPosition({ x: 1250, y: 64 }, mobile);
  assert.deepEqual(next, { x: 286, y: 186 });
  assert.ok(next.x + mobile.petWidth <= mobile.viewportWidth - 8);
});

test("navigation growing to two local-step rows keeps the companion below it", () => {
  assert.equal(clampPetPosition({ x: 220, y: 186 }, { ...mobile, navigationBottom: 240 }).y, 248);
});

test("a saved position already clear of navigation stays unchanged", () => {
  assert.deepEqual(clampPetPosition({ x: 200, y: 410 }, mobile), { x: 200, y: 410 });
});

test("a taller speech bubble stays within the available content viewport", () => {
  const next = clampPetPosition({ x: 220, y: 720 }, { ...mobile, petHeight: 180 });
  assert.equal(next.y, 656);
  assert.ok(next.y >= mobile.navigationBottom + 8);
});

test("a short viewport never pulls the companion back over navigation", () => {
  assert.equal(clampPetPosition({ x: 200, y: 50 }, { ...mobile, viewportHeight: 300, navigationBottom: 240 }).y, 248);
});

test("repeated layout measurements settle at the same position", () => {
  const first = clampPetPosition({ x: 1000, y: -50 }, mobile);
  assert.deepEqual(clampPetPosition(first, mobile), first);
});
