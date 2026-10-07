import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { createResumeStore } from "../src/infrastructure/storage/resumeStore.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
import { parseResumeRecord } from "../src/features/resume/repository.ts";
import { parseResumeYaml, documentYaml, applySections, moveSection, moveItem } from "../src/features/resume/document.ts";
import { detectContacts, redactResume, evidenceFromText } from "../src/features/resume/redaction.ts";
import { mergeResumeSkills } from "../src/features/resume/skills.ts";
const file = name => readFileSync(new URL(name, import.meta.url), "utf8");
const document = { cv: { sections: { Skills: [{ bullet: "Analytical thinking" }], Projects: [{ name: "Own project", summary: "User-supplied detail" }] } }, design: { theme: "engineeringresumes" } };

test("IndexedDB saves a Blob and restores after connection close, separately per account", async () => {
  const factory = new IDBFactory(), store = createResumeStore(factory);
  const draft = { ...emptyDraft("a"), revision: 1, pendingJobRequirements: "Saved unfinished job requirements", source: { file: new Blob(["original"], { type: "application/pdf" }), name: "resume.pdf", text: "facts", redactedText: "facts", contacts: {}, reviewed: false } };
  await store.update("a", () => draft); await store.close();
  assert.equal((await store.read("a")).pendingJobRequirements, draft.pendingJobRequirements);
  assert.equal(await (await store.read("a")).source.file.text(), "original");
  assert.equal(await store.read("b"), null);
  await store.clear("a"); assert.equal(await store.read("a"), null); await store.close();
});
test("transaction failure never replaces a corrupt existing record", async () => {
  const store = createResumeStore(new IDBFactory());
  await store.update("a", () => ({ corrupt: true }));
  await assert.rejects(store.update("a", raw => { parseResumeRecord(raw, "a"); }), /not been overwritten/);
  assert.deepEqual(await store.read("a"), { corrupt: true }); await store.close();
});
test("blocked storage does not pretend to save and no guest storage is allowed", async () => {
  const store = createResumeStore(undefined);
  await assert.rejects(store.read("a"), /unavailable/);
  await assert.rejects(store.update("", () => ({})), /Sign in/);
});
test("account mismatch and unknown local record versions fail closed", () => {
  for (const record of [{ ...emptyDraft("b"), revision: 1 }, { ...emptyDraft("a"), version: 2, revision: 1 }]) assert.throws(() => parseResumeRecord(record, "a"), /not been overwritten/);
});
test("readwrite transactions serialize revision checks between tabs", async () => {
  const store = createResumeStore(new IDBFactory());
  const results = await Promise.allSettled([1, 2].map(id => store.update("a", raw => {
    if (raw) throw new Error("Another tab changed this resume"); return { id, revision: 1 };
  })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1); await store.close();
});
test("form/YAML preserves section order, links, advanced styling and factual fields", () => {
  const input = { ...document, cv: { ...document.cv, email: ["one@example.test", "two@example.test"], social_networks: [{ network: "GitHub", username: "example" }] }, design: { ...document.design, links: { underline: false } } };
  const parsed = parseResumeYaml(documentYaml(input));
  assert.equal(parsed.error, ""); assert.deepEqual(parsed.document, input);
  assert.deepEqual(Object.keys(parsed.document.cv.sections), ["Skills", "Projects"]);
});
test("all built-in themes validate and unsafe/custom settings are retained as YAML errors", () => {
  for (const theme of ["classic", "ember", "engineeringclassic", "engineeringresumes", "harvard", "ink", "moderncv", "opal", "sb2nov"]) assert.equal(parseResumeYaml(documentYaml({ ...document, design: { theme } })).error, "");
  for (const yaml of ["cv: [broken", "cv: {}\nunknown: keep-this", "cv: {}\ndesign:\n  theme: custom", "cv: {}\nsettings:\n  render_command:\n    pdf_path: /private", 'cv:\n  sections:\n    Skills:\n      - bullet: \'#read("/private")\'']) {
    assert.equal(parseResumeYaml(yaml).document, null); assert.ok(parseResumeYaml(yaml).error);
  }
});
test("regeneration changes selected sections only and preserves personal information", () => {
  const old = { ...document, cv: { ...document.cv, name: "User-supplied name" } };
  const next = applySections(old, [{ title: "Skills", entries: [{ text: "Improved wording", skill_ids: ["a"], fact_ids: [] }] }]);
  assert.equal(next.cv.name, old.cv.name);
  assert.deepEqual(next.cv.sections.Projects, old.cv.sections.Projects);
  assert.equal(next.cv.sections.Skills[0].bullet, "Improved wording");
  assert.equal(old.cv.sections.Skills[0].bullet, "Analytical thinking");
});
test("section and entry reordering is stable and does not mutate the original", () => {
  assert.deepEqual(Object.keys(moveSection(document, "Projects", -1).cv.sections), ["Projects", "Skills"]);
  assert.deepEqual(moveItem([1, 2], 0, -1), [1, 2]); assert.deepEqual(moveItem([1, 2], 0, 1), [2, 1]);
});
test("all skill sources, including added learning skills, become one deduplicated list", () => {
  const result = mergeResumeSkills([[{ id: "owned", name: "Analytical thinking" }], [{ id: "learning", name: "Python" }, { id: "duplicate", name: "analytical thinking" }]]);
  assert.equal(result.length, 2); assert.ok(result.some(s => s.name === "Python"));
  assert.ok(result.every(s => !Object.hasOwn(s, "learning")));
});
test("redaction removes personal fields and keeps literal dates and measurable evidence", () => {
  const text = "Alex Example\nalex@example.test\n+61 412 345 678\nAcme, 2022-01-15\nBuilt 12 reports.";
  const contacts = detectContacts(text), redacted = redactResume(text, contacts);
  assert.equal(contacts.name, "Alex Example"); assert.doesNotMatch(redacted, /Alex Example|alex@example|412 345/);
  assert.match(redacted, /2022-01-15/); assert.match(redacted, /12 reports/);
  assert.ok(evidenceFromText(redacted).every(f => f.text !== "[REDACTED]"));
  assert.throws(() => evidenceFromText("x".repeat(60001)), /60,000/);
});
test("My Plan upload branches before reading/adding synced learning resources", () => {
  for (const path of ["../src/pages/LearningGoals/LearningPlanSetup.tsx", "../src/pages/LearningPlanOnboarding/LearningPlanPreferences.tsx"]) {
    const source = file(path);
    assert.ok(source.indexOf("await resumeAttachment.attach(file)") < source.indexOf("await file.text()"));
    assert.match(source, /RESOURCE_ACCEPT.*RESUME_ACCEPT/); assert.match(source, /Job requirements are still required/);
  }
  assert.doesNotMatch(file("../src/features/resume/repository.ts"), /commitWorkspaceItems|saveWorkspaceItems|accountStorage/);
});
test("resume route is separate from Continue Journey, and skill action remains outside the details summary", () => {
  const routes = file("../src/constants/routes.ts"), page = file("../src/pages/Possibilities/Possibilities.tsx");
  assert.match(routes, /resumeBuilder: "\/career\/possibilities\/resume"/); assert.match(routes, /continue: "\/resume"/);
  assert.match(page, /navigate\(ROUTES.resumeBuilder\); \}\}>Generate resume/);
  assert.ok(page.indexOf("</details> :") < page.indexOf('"Add to Skill Path"'));
});
test("draft restoration/clearing and stale PDF guards are explicit", () => {
  const page = file("../src/pages/ResumeBuilder/ResumeBuilder.tsx"), draft = file("../src/features/resume/useResumeDraft.ts");
  assert.match(page, /pdfKey === fingerprint/); assert.match(page, /request.signal.aborted/);
  assert.match(page, /unappliedYaml/); assert.match(page, /Personal-field mappings stay local/);
  assert.match(draft, /currentWorkspaceSession/); assert.match(draft, /await queue.current/);
  assert.doesNotMatch(file("../src/services/accountStorage.ts"), /resume.local|resumeBuilder/);
});
import { explicitResumeSkills } from "../src/features/resume/sourceSkills.ts";
import { checkDocx } from "../src/features/resume/docxArchive.ts";
import { validateResumeFile, MAX_RESUME_BYTES } from "../src/features/resume/importResume.ts";
import { docxFixture, makeZip, arrayBuffer } from "./resume-fixtures.mjs";

test("PDF/DOCX upload limits reject zero/oversized and other formats", () => {
  for (const name of ["cv.pdf", "CV.DOCX"]) assert.equal(validateResumeFile({ name, size: MAX_RESUME_BYTES }), "");
  for (const file of [{ name: "cv.pdf", size: 0 }, { name: "cv.docx", size: MAX_RESUME_BYTES + 1 }, { name: "cv.html", size: 4 }]) assert.ok(validateResumeFile(file));
});
test("explicit original skills only come from a labelled block and are reviewed as one list", () => {
  assert.deepEqual(explicitResumeSkills("Alex\nSkills\nSQL, Python\nExperience\nWorked at Acme"), ["SQL", "Python"]);
  assert.deepEqual(explicitResumeSkills("Worked with Python"), []);
  assert.deepEqual(explicitResumeSkills("Skills\nalex@example.test\n[REDACTED]\nSQL\nEducation\nAcme University"), ["SQL"]);
});
test("DOCX archive permits a genuine text document and rejects damaged/empty/path ZIPs", async () => {
  await checkDocx(arrayBuffer(docxFixture()));
  for (const bytes of [Buffer.from("broken"), makeZip([]), makeZip([["../word/document.xml", "unsafe"]])]) await assert.rejects(checkDocx(arrayBuffer(bytes)));
});
test("DOCX declared and actual inflation are both bounded; encrypted ZIP is rejected", async () => {
  for (const mode of ["oversized", "forged", "encrypted"]) {
    const bytes = Buffer.from(docxFixture());
    const index = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    if (mode === "oversized") bytes.writeUInt32LE(11 * 1024 * 1024, index + 24);
    if (mode === "forged") bytes.writeUInt32LE(1, index + 24);
    if (mode === "encrypted") bytes.writeUInt16LE(1, index + 8);
    await assert.rejects(checkDocx(arrayBuffer(bytes)));
  }
});
test("corrupt local nested sections/proposals cannot crash restoration or be overwritten", () => {
  const base = { ...emptyDraft("a"), revision: 1 };
  for (const extra of [{ document: { cv: { sections: { Skills: null } } } }, { proposal: {} }, { recommendations: [null] }, { previous: {} }]) assert.throws(() => parseResumeRecord({ ...base, ...extra }, "a"), /not been overwritten/);
});
test("raw Typst math, symbol calls, file links and embedded images fail safely", () => {
  for (const bullet of ['#std.eval("danger")', '$$read("private")$$', '[link](file:///private)', '![image](https://example.test/img)']) assert.ok(parseResumeYaml(documentYaml({ cv: { sections: { Skills: [{ bullet }] } } })).error);
  assert.equal(parseResumeYaml(documentYaml({ cv: { website: "https://example.com/#about" }, design: { colors: { section_titles: "#aabbcc" } } })).error, "");
});

test("deduplication preserves C/C++/C# and bounds stable source IDs", () => {
  const result = mergeResumeSkills([[{ id: "c", name: "C" }, { id: "cpp", name: "C++" }, { id: "cs", name: "C#" }, { id: "same", name: " c++ " }, { id: "long", name: "x".repeat(160) }]]);
  assert.equal(result.length, 4); assert.ok(result.every(skill => skill.id.length <= 160));
  assert.equal(new Set(result.map(skill => skill.id)).size, 4);
});
test("encrypted Office containers get an actionable message, not an OCR/password prompt", async () => {
  const bytes = Buffer.alloc(24); bytes.writeUInt32LE(0xe011cfd0); bytes.writeUInt32LE(0xe11ab1a1, 4);
  await assert.rejects(checkDocx(arrayBuffer(bytes)), /encrypted.*unencrypted DOCX/);
});

import { EXAMPLE_JOB_REQUIREMENTS, emptyResumeDocument, resumeGenerationAction } from "../src/features/resume/onboarding.ts";
const firstUse = { jobRequirements: EXAMPLE_JOB_REQUIREMENTS, hasDocument: false, skillCount: 0, factCount: 0, skillsLoading: false, skillError: "", sourceReviewed: null, aiConfigured: false, busy: false };
test("fixed classroom example contains requirements, not personal facts or skill seeding", () => {
  assert.match(EXAMPLE_JOB_REQUIREMENTS, /^Junior Data Analyst\nResponsibilities and requirements:/);
  assert.match(EXAMPLE_JOB_REQUIREMENTS, /Excel and SQL/); assert.match(EXAMPLE_JOB_REQUIREMENTS, /Python/);
  assert.equal(EXAMPLE_JOB_REQUIREMENTS.split("\n").length, 7);
  assert.ok(EXAMPLE_JOB_REQUIREMENTS.length < 20000);
  assert.deepEqual(emptyResumeDocument().cv, { sections: { Skills: [] } });
  assert.equal(parseResumeYaml(documentYaml(emptyResumeDocument())).error, "");
});
test("zero-skill first use creates a local blank draft even with AI unavailable", () => {
  assert.equal(resumeGenerationAction(firstUse), "blank");
  assert.equal(resumeGenerationAction({ ...firstUse, aiConfigured: true }), "blank");
  assert.equal(resumeGenerationAction({ ...firstUse, aiConfigured: null }), "blank");
});
test("job requirements and successful skill loading remain mandatory", () => {
  for (const change of [{ jobRequirements: "   " }, { skillsLoading: true }, { skillError: "unreadable skills" }, { busy: true }]) {
    assert.equal(resumeGenerationAction({ ...firstUse, ...change }), null);
  }
});
test("unreviewed source cannot bypass consent through empty-draft generation", () => {
  assert.equal(resumeGenerationAction({ ...firstUse, sourceReviewed: false }), null);
  assert.equal(resumeGenerationAction({ ...firstUse, sourceReviewed: true }), "blank");
});
test("existing drafts are never replaced by an empty generation fallback", () => {
  assert.equal(resumeGenerationAction({ ...firstUse, hasDocument: true }), null);
  assert.equal(resumeGenerationAction({ ...firstUse, hasDocument: true, skillCount: 1, aiConfigured: true }), "ai");
});
test("skills or reviewed evidence use AI and retain provider-availability protection", () => {
  for (const source of [{ skillCount: 1 }, { factCount: 1, sourceReviewed: true }]) {
    assert.equal(resumeGenerationAction({ ...firstUse, ...source, aiConfigured: true }), "ai");
    assert.equal(resumeGenerationAction({ ...firstUse, ...source, aiConfigured: false }), null);
  }
});
test("first-use controls hide provider details and preserve expandable privacy/confirmation", () => {
  const page = file("../src/pages/ResumeBuilder/ResumeBuilder.tsx");
  assert.doesNotMatch(page, /ai_provider_host|ai_model|available skills|20,000 characters|rb-skill-chips/);
  assert.match(page, /Privacy details/); assert.match(page, /Third-party provider retention policies/);
  assert.match(page, /Replace your job requirements\?/); assert.match(page, /!draft.document && <div className="rb-example-action"/);
  assert.match(page, /Retry skills/); assert.match(page, /generationAction === "blank"/);
});
test("nullable engine section mapping restores without treating a valid saved draft as corruption", () => {
  const doc = { cv: { sections: null } };
  assert.equal(parseResumeYaml(documentYaml(doc)).error, "");
  const record = { ...emptyDraft('a'), revision: 1, document: doc, yamlText: documentYaml(doc) };
  assert.equal(parseResumeRecord(record, 'a').document.cv.sections, null);
});
