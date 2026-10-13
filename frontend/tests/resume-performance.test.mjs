import test from "node:test";
import assert from "node:assert/strict";
import { createResumePreviewCache } from "../src/features/resume/previewCache.ts";
import { documentYaml, parseResumeYaml, validateResumeDocument } from "../src/features/resume/document.ts";
const pdf = text => new Blob([text], { type: "application/pdf" });

test("preview cache uses exact complete document keys, LRU and bounded bytes", () => {
  const cache = createResumePreviewCache(2, 10), first = pdf("1111"), second = pdf("2222"), third = pdf("3333");
  cache.set("cv-and-design-a", first); cache.set("cv-and-design-b", second);
  assert.equal(cache.get("cv-and-design-a"), first); cache.set("cv-and-design-c", third);
  assert.equal(cache.get("cv-and-design-b"), undefined); assert.equal(cache.get("cv-and-design-c"), third);
  cache.set("large", pdf("large PDF beyond this test budget")); assert.equal(cache.get("large"), undefined);
  cache.set("cv-and-design-a", pdf("1234567")); assert.equal(cache.get("cv-and-design-c"), undefined);
});
test("oversized replacement drops stale bytes; clearing and separate accounts never reuse PDFs", () => {
  const a = createResumePreviewCache(4, 4), b = createResumePreviewCache(4, 4);
  a.set("same-key", pdf("a")); assert.equal(b.get("same-key"), undefined);
  a.set("same-key", pdf("too large")); assert.equal(a.get("same-key"), undefined);
  a.set("same-key", pdf("a")); a.clear(); assert.equal(a.get("same-key"), undefined);
});
test("form object validation retains the YAML path's schema, contact and resource guards", () => {
  const valid = { cv: { name: "Synthetic", email: "Free text contact", sections: { Skills: [{ bullet: "SQL" }] } } };
  for (const input of [valid, { ...valid, cv: { ...valid.cv, photo: "https://example.test/photo.png" } }, { ...valid, cv: { ...valid.cv, email: { bad: "shape" } } }, { ...valid, settings: { output_folder: "/private" } }, { cv: { sections: { Projects: [{ name: "#read(private)", highlights: [] }] } } }, { cv: { sections: { Skills: [{ bullet: "![private](file:///private)" }] } } }]) {
    const before = structuredClone(input), yaml = documentYaml(input);
    assert.equal(Boolean(validateResumeDocument(input, yaml).error), Boolean(parseResumeYaml(yaml).error));
    assert.deepEqual(input, before);
  }
});
test("form object validation keeps alias expansion and source text limits", () => {
  const shared = { bullet: "SQL" }, aliasInput = { cv: { sections: { Skills: Array(40).fill(shared) } } };
  assert.ok(validateResumeDocument(aliasInput).error); assert.ok(parseResumeYaml(documentYaml(aliasInput)).error);
  const long = { cv: { headline: "x".repeat(150001) } };
  assert.match(validateResumeDocument(long).error, /text limit/);
});
