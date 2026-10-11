import test from "node:test";
import assert from "node:assert/strict";
import { controlFields, controls, effectiveMerge, updateControl, ENTRY_TYPES, entryType, entryFields, renameSection, formatSelection, networkOptions } from "../src/features/resume/editorModel.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
import { parseResumeYaml, documentYaml, THEMES, resumeRenderDocument } from "../src/features/resume/document.ts";
const document = { cv: { sections: { Skills: [{ bullet: "User fact" }], Projects: [{ name: "User project" }] } }, design: { theme: "classic" } };
for (const theme of THEMES) test(`pinned ${theme}: all safe default leaf controls validate and don't mutate the document`, () => {
  const doc = { ...document, design: { theme } }, before = structuredClone(doc);
  const fields = controlFields(doc, "design");
  assert.ok(fields.length > 65);
  assert.ok(fields.some(f => f.path.join(".") === "page.size" && f.options.includes("a4")));
  assert.ok(fields.some(f => f.path.join(".") === "typography.font_family.body" && f.options.includes("Lato")));
  assert.ok(fields.every(f => !f.path.includes("templates") && !f.path.some(key => key.startsWith("photo"))));
  assert.deepEqual(doc, before);
  let updated = doc;
  for (const field of fields) updated = updateControl(updated, "design", field.path, field.value);
  assert.equal(parseResumeYaml(documentYaml(updated)).error, "");
});
test("all locale and settings defaults validate; viewing controls writes nothing", () => {
  assert.equal(controls.version, "2.8"); assert.ok(Object.keys(controls.locales).length > 20);
  for (const language of Object.keys(controls.locales)) {
    let doc = { ...document, locale: { language } };
    for (const field of controlFields(doc, "locale")) doc = updateControl(doc, "locale", field.path, field.value);
    assert.equal(parseResumeYaml(documentYaml(doc)).error, "", language);
  }
  const before = structuredClone(document);
  assert.deepEqual(controlFields(document, "settings").map(f => f.path[0]), ["current_date", "bold_keywords", "pdf_title"]);
  assert.deepEqual(document, before);
});
test("single design edits write only that path; scalar and unknown explicit overrides are retained", () => {
  const doc = { ...document, design: { theme: "classic", typography: { font_family: "Lato" }, retained: { note: 1 } } };
  const next = updateControl(doc, "design", ["page", "top_margin"], "1in");
  assert.deepEqual(next.design, { ...doc.design, page: { top_margin: "1in" } });
  const body = updateControl(doc, "design", ["typography", "font_family", "body"], "Roboto");
  assert.equal(body.design.typography.font_family.body, "Roboto");
  for (const value of Object.values(body.design.typography.font_family).slice(1)) assert.equal(value, "Lato");
  assert.equal(doc.design.typography.font_family, "Lato");
  assert.deepEqual(effectiveMerge({ body: false, name: true }, true), { body: true, name: true });
});
test("nine types have distinct empty seeds, user-populated entries validate, no example facts", () => {
  assert.equal(Object.keys(ENTRY_TYPES).length, 9);
  const doc = { cv: { sections: {} } };
  for (const [name, seed] of Object.entries(ENTRY_TYPES)) {
    assert.equal(entryType(seed), name);
    assert.ok(Object.values(typeof seed === "string" ? {} : seed).every(value => value === "" || Array.isArray(value) && !value.length));
    const entry = typeof seed === "string" ? "User text" : Object.fromEntries(Object.entries(seed).map(([key, value]) => [key, Array.isArray(value) ? ["Own author"] : "User fact"]));
    doc.cv.sections[name] = [entry];
  }
  assert.equal(parseResumeYaml(documentYaml(doc)).error, "");
  assert.ok(entryFields({ company: "Own", position: "Own" }).includes("highlights"));
  assert.ok(networkOptions.includes("LinkedIn"));
});
test("renaming preserves sequence, unknown data and entries; unsafe/duplicate section titles rejected", () => {
  assert.deepEqual(Object.keys(renameSection(document, "Skills", "Competencies").cv.sections), ["Competencies", "Projects"]);
  for (const title of ["Projects", "__proto__", "@personal", "", "x".repeat(101)]) assert.throws(() => renameSection(document, "Skills", title));
  assert.deepEqual(Object.keys(document.cv.sections), ["Skills", "Projects"]);
});
test("Markdown applies only the selected characters and rejects resource/code link protocols", () => {
  assert.deepEqual(formatSelection("SQL and Python", 0, 3, "bold"), { text: "**SQL** and Python", start: 2, end: 5 });
  assert.equal(formatSelection("SQL", 0, 3, "italic").text, "*SQL*");
  assert.equal(formatSelection("SQL", 0, 3, "link", "https://example.test").text, "[SQL](https://example.test)");
  for (const url of ["javascript:alert(1)", "file:///private", "data:text/plain,a", "https://example.test/\"bad", "https://example.test/<x>"]) assert.throws(() => formatSelection("SQL", 0, 3, "link", url));
});
const draft = (text, target = "Target A") => ({ ...emptyDraft("a"), document: { cv: { sections: { Skills: [{ bullet: text }] } } }, yamlText: text, jobRequirements: target, pendingJobRequirements: target });
test("500ms same-field merge, separate structural steps, redo invalidation and cloned snapshots", () => {
  const history = createEditorHistory(), a = draft("a"), b = draft("b"), c = draft("c"), d = draft("d");
  history.record(a, b, "field", 0); history.record(b, c, "field", 400); history.record(c, d, null, 450);
  assert.equal(history.undo().yamlText, "c"); const snapshot = history.undo(); assert.equal(snapshot.yamlText, "a"); snapshot.yamlText = "mutation";
  assert.equal(history.redo().yamlText, "c");
  history.record(c, draft("e"), "field", 700); assert.equal(history.canRedo, false);
  assert.equal(history.undo().yamlText, "c");
});
test("history is capped at50 and is account-local; AI target/gaps/courses/previous restore together", () => {
  const history = createEditorHistory();
  for (let i = 0; i < 55; i++) history.record(draft(String(i)), draft(String(i + 1)));
  for (let i = 54; i >= 5; i--) assert.equal(history.undo().yamlText, String(i));
  assert.equal(history.canUndo, false); assert.equal(createEditorHistory().canRedo, false);
  history.clear(); const before = draft("old"), after = { ...draft("new", "Target B"), gaps: [{ id: "gap" }], recommendations: [], previous: { document: before.document, yamlText: "old", jobRequirements: "Target A" } };
  history.record(before, after); history.sync({ ...after, recommendations: [{ course_id: "course" }] });
  assert.equal(history.undo().jobRequirements, "Target A"); const redo = history.redo(); assert.equal(redo.pendingJobRequirements, undefined, "Undo never restores the selected pending target"); assert.equal(redo.recommendations[0].course_id, "course"); assert.equal(redo.previous.yamlText, "old");
});
test("invalid YAML history restores the last successfully rendered document, not a newer unrelated preview", () => {
  const history = createEditorHistory(), a = { ...draft('a'), previewDocument: draft('a').document }, invalid = { ...draft('a'), yamlText: 'broken: [', previewDocument: draft('a').document };
  history.record(a, invalid, 'yaml'); history.record(invalid, { ...draft('b'), previewDocument: draft('a').document });
  history.sync({ ...draft('b'), previewDocument: draft('b').document });
  assert.deepEqual(history.undo().previewDocument, a.document);
  assert.deepEqual(history.redo().previewDocument, draft('b').document);
});


test("blank scalar contacts in restored drafts are omitted only from the render copy", () => {
  const draft = { ...document, cv: { ...document.cv, email: "", phone: "  ", website: "\n\t", location: "Retain this field" } };
  const original = documentYaml(draft);
  const render = resumeRenderDocument(draft);
  assert.deepEqual([render.cv.email, render.cv.phone, render.cv.website], [null, null, null]);
  assert.equal(render.cv.location, "Retain this field");
  assert.equal(documentYaml(draft), original);
  assert.equal(parseResumeYaml(documentYaml(render)).error, "");
  assert.deepEqual(resumeRenderDocument(render), render);
});

test("empty contact list rows do not invalidate preview or reorder actual contacts", () => {
  const draft = { ...document, cv: { ...document.cv, email: ["", "first@example.com", "  ", "second@example.com"], phone: ["", "+61 412 345 678"], website: ["", "\t"] } };
  const before = structuredClone(draft);
  const render = resumeRenderDocument(draft);
  assert.deepEqual(render.cv.email, ["first@example.com", "second@example.com"]);
  assert.deepEqual(render.cv.phone, ["+61 412 345 678"]);
  assert.equal(render.cv.website, null);
  assert.deepEqual(draft, before);
  assert.equal(parseResumeYaml(documentYaml(render)).error, "");
});

test("contact normalisation never rewrites non-empty text or changes other fields", () => {
  const draft = { ...document, cv: { ...document.cv, name: "", extra_fact: "Retained unknown fact", email: "not an email", phone: ["", "0412345678", null, 7], website: "www.example.com" }, settings: { pdf_title: "" } };
  const render = resumeRenderDocument(draft);
  assert.equal(render.cv.email, "not an email");
  assert.deepEqual(render.cv.phone, ["0412345678", null, 7]);
  assert.equal(render.cv.website, "www.example.com");
  assert.equal(render.cv.name, "");
  assert.equal(render.cv.extra_fact, "Retained unknown fact");
  assert.deepEqual(render.settings, draft.settings);
  const untouched = resumeRenderDocument(document);
  assert.equal(Object.hasOwn(untouched.cv, "email"), false);
  assert.equal(Object.hasOwn(untouched.cv, "phone"), false);
  assert.equal(Object.hasOwn(untouched.cv, "website"), false);
});


test("email, local phones, plain websites and punctuation are free text in form/YAML", () => {
  const draft = { ...document, cv: { ...document.cv, email: "My email contact", phone: ["0412345678", "Office #123"], website: ['www.example.com', '#read("private.txt")', '[label](file:///private)', '**Literal stars**'] } };
  const yaml = documentYaml(draft);
  const parsed = parseResumeYaml(yaml);
  assert.equal(parsed.error, "");
  assert.deepEqual(parsed.document, draft);
  assert.equal(documentYaml(draft), yaml);
  assert.notEqual(parseResumeYaml(documentYaml({ cv: { sections: { Skills: [{ bullet: '#read("private.txt")' }] } } })).error, "");
  for (const value of [123, { invalid: "object" }, [null], ["Text", 123]]) assert.match(parseResumeYaml(documentYaml({ cv: { email: value } })).error, /must be text or a list of text values/);
});

test("phone-number reformatting is not exposed for literal user-entered phone text", () => {
  const draft = { ...document, design: { theme: "classic", header: { connections: { phone_number_format: "international" } } } };
  const before = documentYaml(draft);
  assert.equal(controlFields(draft, "design").some(field => field.path.join(".") === "header.connections.phone_number_format"), false);
  assert.equal(documentYaml(draft), before);
});


test("hidden locale keeps English defaults without adding fields to new drafts", () => {
  const before = documentYaml(document);
  assert.equal(controlFields(document, "locale").find(field => field.path[0] === "present").value, "present");
  const edited = updateControl(document, "settings", ["pdf_title"], "Own title");
  assert.equal(Object.hasOwn(edited, "locale"), false);
  assert.equal(Object.hasOwn(resumeRenderDocument(edited), "locale"), false);
  assert.equal(documentYaml(document), before);
});

test("existing locale survives form edits, YAML round-trips and render preparation", () => {
  const locale = { language: "french", present: "En cours", last_updated: "Mis à jour en", month_abbreviations: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."] };
  const draft = { ...document, locale };
  const before = structuredClone(draft);
  let edited = updateControl(draft, "design", ["page", "top_margin"], "1in");
  edited = updateControl(edited, "settings", ["pdf_title"], "Own title");
  edited = renameSection(edited, "Skills", "Competencies");
  const parsed = parseResumeYaml(documentYaml(edited));
  assert.equal(parsed.error, "");
  assert.deepEqual(parsed.document.locale, locale);
  assert.deepEqual(resumeRenderDocument(parsed.document).locale, locale);
  assert.deepEqual(draft, before);
});
