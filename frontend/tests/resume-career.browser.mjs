import { snapshotRole } from './resume-reference-fixtures.mjs';
import { applyReviewedResume } from "./resume-browser-review.mjs";
/** Offline Epic 8 acceptance. Synthetic references do not validate real-model relevance. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { docxFixture } from "./resume-fixtures.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AIW_QA_ORIGIN || "http://127.0.0.1:5186", backend = "http://127.0.0.1:8016";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const out = fileURLToPath(new URL("../../.local/resume-qa/career-evidence", import.meta.url)); await mkdir(out, { recursive: true });
const role = (occupation_code, title, ids) => ({ occupation_code, title, skills: ids.map(([skill_id, name, skill_slug]) => ({ skill_id, name, skill_slug })), tasks: ["Synthetic reference: analyse records and prepare appropriate reports."] });
const roles = new Map([
  role("2421", "Management and Organisation Analysts", [[1, "Analytical thinking", "analytical-thinking"]]),
  role("2512", "Software Developers", [[23, "Programming", "programming"], [1, "Analytical thinking", "analytical-thinking"]]),
  role("4111", "General Office Clerks", [[21, "Reading, writing and mathematics", "reading-writing-and-mathematics"]]),
].map(row => [row.occupation_code, row]));
const key = "aiwrevolusi.possibilities.chosenDirection", at = "2026-10-10T00:00:00Z";
const goal = { id: "g1", sourceKey: "synthetic-goal", createdAt: at, initial: { skill: { source: "personal", id: "sql", label: "SQL", sourceVersion: null }, decision: null, tasks: [], occupationCode: null, sourceOccupationUri: null, career: null, origin: "browse", workKey: null, wording: "Practise SQL" }, wording: "Practise SQL", action: null, attempts: [{ id: "a1", date: "2026-09-20", type: "course_practice", description: "Used SQL joins on a synthetic dataset.", notes: "", task: null, createdAt: at, updatedAt: at }], history: [], revision: 1, needsReview: false, updatedAt: at };
let owner = "career-evidence-a", workspace = {
  [key]: JSON.stringify({ occupation_code: "2421" }),
  "aiwrevolusi.learningSkills.v1": JSON.stringify([{ id: "programming", name: "Programming", source: "wef" }]),
  "aiwrevolusi.courseLibrary.v1": JSON.stringify({ version: 1, workContext: "", skillId: "", saved: ["finished", "unfinished"], choices: {}, basis: {}, pending: [] }),
  "aiwrevolusi.learningGoals.v1": JSON.stringify({ version: 1, goals: [goal] }),
}, revision = 0, scenario = "career_evidence", progress = [{ course_id: "finished", skill_id: "analytical-thinking", chapter_index: 0, value: 10 }, { course_id: "finished", skill_id: "analytical-thinking", chapter_index: 1, value: 10 }, { course_id: "unfinished", skill_id: "reading-writing-and-mathematics", chapter_index: 0, value: 9 }];
const sample = ["Synthetic Person", "synthetic@example.test", "Skills", "SQL, Excel, Microsoft Office, Communication", "Analytical thinking", "Life insurance", "Professional Experience", "ABC Insurance Berhad, Kuala Lumpur", "Insurance Sales Representative Jan 2021 – Present", "• Managed 250+ clients, achieving a 92% policy renewal rate.", "XYZ Financial Services, Petaling Jaya", "• Maintained a 95% customer satisfaction score.", "Projects", "Retail Sales Analysis | Apr 2026", "• Cleaned 2,400 records in Excel and removed 36 duplicates.", "• Used SQL joins and aggregations to compare monthly sales.", "Student Survey Review | Nov 2025", "• Reviewed 180 anonymous responses.", "Education", "Synthetic university course" ];
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const page = await context.newPage(); page.setDefaultTimeout(30000);
let releaseProgress; let progressGate = new Promise(resolve => { releaseProgress = resolve; });
const requests = [], errors = []; page.on("pageerror", error => errors.push(error.message));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(snapshotRole(body)) });
await context.route("**/*", async route => {
  const req = route.request(), url = new URL(req.url()); if (url.origin !== origin && !["blob:", "data:"].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue(); const path = url.pathname.replace("/api/v1", "");
  if (path === "/account/me") return json(route, { id: owner, email: "synthetic@example.test", full_name: "Synthetic account" });
  if (path === "/account/workspace") { if (req.method() === "PATCH") { const body = req.postDataJSON(); workspace = body.data; revision = body.revision + 1; } return json(route, { owner_id: owner, data: workspace, revision }); }
  if (path === "/reference/wef-skills") return json(route, [{ wef_skill_id: 1, core_skill: "Analytical thinking" }, { wef_skill_id: 23, core_skill: "Programming" }, { wef_skill_id: 21, core_skill: "Reading, writing and mathematics" }]);
  if (path === "/learning/courses") return json(route, { found: true, courses: [{ course_id: "finished", title: "Synthetic analysis course", provider: "Synthetic learning", skill_id: "analytical-thinking", chapter_count: 2, chapters: [{ order: 1, title: "A" }, { order: 2, title: "B" }] }, { course_id: "unfinished", title: "Unfinished course must not be completion evidence", skill_id: "reading-writing-and-mathematics", chapter_count: 1, chapters: [{ order: 1, title: "A" }] }] });
  if (path === "/learning/progress") { if (progressGate) await progressGate; return json(route, { chapters: progress }); }
  if (path === "/resume/capabilities") return json(route, { ai_configured: true, rendercv_version: "2.8" });
  const target = path.match(/^\/possibilities\/([^/]+)\/requirements$/); if (target) return json(route, roles.get(target[1]));
  if (path === "/resume/recommend-courses") return json(route, { courses: [] });
  if (path === "/resume/generate") { const input = req.postDataJSON(); requests.push(input); const response = await route.fetch({ url: backend + url.pathname, headers: { ...req.headers(), "X-Resume-QA-Role": JSON.stringify(roles.get(input.occupation_code)), "X-Resume-QA-Scenario": scenario } }); return route.fulfill({ response }); }
  if (path === "/resume/render" || path === "/resume/assist") { const response = await route.fetch({ url: backend + url.pathname, headers: { ...req.headers(), "X-Resume-QA-Scenario": scenario } }); return route.fulfill({ response }); }
  return json(route, { detail: "Synthetic endpoint unavailable" }, 503);
});
const read = (id = owner) => page.evaluate(id => new Promise((resolve, reject) => { const open = indexedDB.open("aiwrevolusi.resume.local.v1", 1); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result, tx = db.transaction("drafts", "readonly"), get = tx.objectStore("drafts").get(id); tx.oncomplete = () => { resolve(get.result); db.close(); }; }; }), id);
const saved = () => page.getByText("Saved on this device", { exact: true }).waitFor();
const targetPage = async () => { await page.getByRole("button", { name: "Target role", exact: true }).click(); await page.getByRole("heading", { name: "Bring your existing resume", exact: true }).waitFor(); };
const proposal = page.getByRole("dialog", { name: "Review AI suggestions" });
const start = async () => { await page.getByRole("button", { name: "Generate new suggestions", exact: true }).click(); const confirm = page.getByRole("dialog", { name: "Tailor for another role?" }); if (await confirm.count()) await confirm.getByRole("button", { name: "Generate suggestions", exact: true }).click(); await proposal.waitFor(); };
const choose = async title => { for (const row of await proposal.locator(".rb-proposal").all()) if (await row.locator("strong").first().textContent() === title) await row.getByRole("checkbox").check(); };
const apply = async () => { await proposal.getByRole("button", { name: "Apply selected chapters", exact: true }).click(); await saved(); };
try {
  await page.goto(origin + "/career/possibilities/resume");
  await page.getByRole("button", { name: "Generate my resume", exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "Generate my resume" && !button.disabled));
  assert.equal(await page.getByRole("button", { name: "Generate my resume", exact: true }).isEnabled(), true, "Optional slow learning progress must not delay generation without selected learning facts");
  releaseProgress(); progressGate = null;
  await page.getByLabel("Upload original resume PDF or DOCX").setInputFiles({ name: "epic8.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docxFixture(sample) });
  await page.getByText("I have reviewed this text and removed", { exact: false }).click();
  const learning = page.locator(".rb-learning-records"); await learning.getByRole("button", { name: /Learning records/ }).click();
  await learning.getByText("You recorded this course as completed", { exact: false }).first().waitFor();
  assert.equal(await learning.locator(".rb-learning-record").filter({has: page.getByRole("checkbox")}).getByText("Unfinished course must not", { exact: false }).count(), 0);
  for (const row of await learning.locator(".rb-learning-record").filter({has: page.getByRole("checkbox")}).all()) { await row.getByRole("checkbox").first().check(); await row.getByRole("checkbox").last().check(); }
  assert.equal(await page.getByLabel("Skills included in your resume").count(), 0);
  await page.screenshot({ path: out + "/learning-review.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "Generate my resume", exact: true }).click(); await proposal.waitFor(); await saved();
  assert.equal((await read()).document, null, "First generation must be reviewed before creating a CV");
  assert.equal((await read()).careerAlignment, undefined);
  await applyReviewedResume(page); await page.locator(".rw-workbench").waitFor(); await saved();
  const initial = await read(); assert.equal(initial.generationOutcome, "tailored"); assert.equal(initial.careerAlignment.alignment.occupation_code, "2421"); assert.equal(initial.careerAlignment.needsReview, false);
  assert.equal(requests[0].source_metadata.learning_facts.length, 2);
  assert.ok(!requests[0].skills.some(skill => /Berhad|Petaling|92%|Synthetic analysis course/.test(skill.name)));
  assert.ok(requests[0].evidence.some(fact => fact.text.includes("92%")));
  assert.ok(initial.document.cv.sections.Summary[0].includes("Career objective: Management"));
  assert.ok(initial.document.cv.sections.Summary[0].includes("2,400"));
  assert.equal(initial.document.cv.sections["Professional Development"].length, 1); assert.equal(initial.document.cv.sections["Learning practice"].length, 1);
  const alignmentPanel = page.locator(".rb-career-alignment").first(); assert.equal(await alignmentPanel.getByRole("button").getAttribute("aria-expanded"), "false");
  await alignmentPanel.getByRole("button").click(); await alignmentPanel.getByText("Standard mapping", { exact: true }).waitFor(); assert.ok(await alignmentPanel.getByText("AI semantic judgment", { exact: true }).count() > 0);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "PDF" && !button.disabled));
  await page.locator(".rw-pdf-page canvas[data-render-state=ready]").first().waitFor({ state: "attached" });
  await page.screenshot({ path: out + "/alignment-desktop.png", fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "PDF", exact: true }).waitFor(); const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "PDF", exact: true }).click(); const pdf = await downloadPromise; await writeFile(out + "/career.pdf", await readFile(await pdf.path()));
  await page.reload(); await page.locator(".rw-workbench").waitFor(); assert.deepEqual((await read()).careerAlignment, initial.careerAlignment);
  // Role changes preserve source/upload, current content and applied target until application.
  workspace[key] = JSON.stringify({ occupation_code: "2512" }); await page.reload(); await page.locator(".rw-workbench").waitFor(); await targetPage(); await start();
  const pending = await read(); assert.equal(pending.careerAlignment.alignment.occupation_code, "2421"); assert.ok(pending.proposal.role_alignment.links.some(link => link.name === "Programming"));
  assert.ok(!pending.proposal.role_alignment.links.some(link => link.name === "Microsoft Office"));
  await choose("Skills"); await apply(); const partial = await read(); assert.deepEqual(partial.careerAlignment.sections, ["Skills"]); assert.ok(partial.careerAlignment.alignment.links.every(link => link.locations.every(location => location.section === "Skills")));
  // One undo/redo restores exact alignment along with the document.
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await saved(); assert.deepEqual((await read()).careerAlignment, initial.careerAlignment);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); await saved(); assert.equal((await read()).careerAlignment.alignment.occupation_code, "2512");
  await targetPage(); await start(); for (const row of await proposal.locator(".rb-proposal").all()) await row.getByRole("checkbox").check(); await apply();
  const software = await read(); assert.equal(software.generationOutcome, "tailored"); assert.ok(software.document.cv.sections.Summary[0].includes("Software Developers")); assert.equal(software.source.name, "epic8.docx");
  assert.ok(software.document.cv.sections.Summary[0].includes("SQL joins"));
  assert.notDeepEqual(software.document.cv.sections.Summary, initial.document.cv.sections.Summary);
  workspace[key] = JSON.stringify({ occupation_code: "4111" }); await page.reload(); await page.locator(".rw-workbench").waitFor(); await targetPage(); await start();
  const clerks = await read(); assert.ok(clerks.proposal.sections.find(section => section.title === "Summary").entries[0].text.includes("General Office Clerks"));
  assert.deepEqual(clerks.proposal.sections.find(section => section.title === "Projects").entries.map(entry => entry.project.date), ["Nov 2025", "Apr 2026"]);
  for (const row of await proposal.locator(".rb-proposal").all()) await row.getByRole("checkbox").check(); await apply();
  const office = await read(); assert.equal(office.generationOutcome, "tailored"); assert.ok(office.document.cv.sections.Summary[0].includes("180")); assert.ok(office.document.cv.sections.Skills.some(entry => entry.bullet === "Reading, writing and mathematics"));
  // Manual edits invalidate explanation; undo restores it.
  const skillsSection = page.locator('.rw-section[data-title="Skills"]'); if (await skillsSection.locator(".rw-section-toggle").getAttribute("aria-expanded") === "false") await skillsSection.locator(".rw-section-toggle").click();
  const field = skillsSection.locator("textarea").first(); await field.fill("Edited skill wording"); await saved(); assert.equal((await read()).careerAlignment.needsReview, true);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await saved(); assert.deepEqual((await read()).careerAlignment, office.careerAlignment);
  // Safe provider fallback keeps only standard matches and the applied interview target.
  scenario = "unavailable"; await targetPage(); await start(); const fallback = await read(); assert.equal(fallback.proposal.outcome, "source_preserved");
  assert.ok(fallback.proposal.role_alignment.links.every(link => link.method === "standard_mapping")); assert.equal(fallback.jobRequirements, office.jobRequirements);
  await proposal.getByRole("button", { name: "Keep current resume", exact: true }).click();
  await page.getByRole("button", { name: "Back to editing", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".rw-edit-scroll").evaluate(element => { element.scrollTop = 0; });
  await page.screenshot({ path: out + "/alignment-mobile.png", fullPage: true, animations: "disabled" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  // Other-account records never inherit sources or explanations.
  owner = "career-evidence-b"; workspace = { [key]: JSON.stringify({ occupation_code: "2421" }) }; await page.reload(); await page.getByRole("button", { name: "Generate my resume", exact: true }).waitFor();
  assert.equal((await read())?.careerAlignment, undefined); assert.equal(await page.locator(".rb-career-alignment").count(), 0); assert.deepEqual((await read("career-evidence-a")).document, office.document);
  assert.deepEqual(errors, []);
  await writeFile(out + "/result.json", JSON.stringify({ syntheticOnly: true, realModelRelevanceEvaluated: false, occupations: [...roles.keys()], generatedRequests: requests.length, checked: ["learning review", "source validation", "career summary", "role-dependent skills", "project priority", "partial apply", "undo redo", "refresh", "manual edit invalidation", "provider fallback", "mobile", "account isolation", "real PDF"] }, null, 2));
  console.log("Epic 8 offline browser acceptance passed");
} finally { await context.unrouteAll({ behavior: "wait" }); await browser.close(); }
