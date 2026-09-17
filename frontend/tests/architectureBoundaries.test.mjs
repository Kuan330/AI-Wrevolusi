import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { checkSourceBoundaries } from "../scripts/architecture-rules.mjs";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: root, paths: { "@/*": ["*"] } };
const check = (name, source) => checkSourceBoundaries(join(root, name), source, options, root);

test("shared modules cannot hide page imports behind relative paths, exports or dynamic imports", () => {
  for (const source of [
    'import Page from "../pages/Plan/Plan";',
    'export { default } from "@/pages/Plan/Plan";',
    'const page = import("../pages/Plan/Plan");',
    'type Page = import("../pages/Plan/Plan");',
  ]) assert.match(check("services/example.ts", source).join("\n"), /shared module must not depend/);
});

test("Plan and Learning Centre cannot import each other's page internals", () => {
  assert.match(check("pages/Plan/example.ts", 'import Page from "../LearningCentre/LearningCentre";').join("\n"), /shared learning-planning/);
  assert.match(check("pages/LearningCentre/example.ts", 'import Page from "../Plan/Plan";').join("\n"), /shared learning-planning/);
});

test("route and evidence UI composition remains allowed", () => {
  assert.deepEqual(check("routes/example.ts", 'import Page from "@/pages/Plan/Plan";'), []);
  assert.deepEqual(check("pages/Analysis/example.ts", 'import Page from "@/pages/AIExposure/AIExposure";'), []);
});

test("storage references are detected in code but not comments or ordinary strings", () => {
  assert.deepEqual(check("pages/Plan/example.ts", '// localStorage is not used\nconst label = "sessionStorage";'), []);
  for (const source of ['localStorage.getItem("x")', 'window.sessionStorage.getItem("x")', 'window["localStorage"].getItem("x")']) {
    assert.match(check("pages/Plan/example.ts", source).join("\n"), /browser storage/);
  }
  assert.deepEqual(check("infrastructure/storage/example.ts", 'localStorage.getItem("x")'), []);
});

test("a broken local import cannot silently evade the boundary check", () => {
  assert.match(check("services/example.ts", 'import value from "@/missing-module";').join("\n"), /cannot resolve local import/);
});
