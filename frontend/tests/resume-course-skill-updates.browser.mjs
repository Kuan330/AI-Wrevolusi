/** Saved-course changes against an existing local resume, with no live AI calls. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { snapshotRole, snapshotCourse } from "./resume-reference-fixtures.mjs";
import { docxFixture } from "./resume-fixtures.mjs";
import { applyReviewedResume } from "./resume-browser-review.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AIW_QA_ORIGIN || "http://127.0.0.1:5188";
const backend = process.env.AIW_QA_BACKEND || "http://127.0.0.1:8017";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(backend, /^http:\/\/127\.0\.0\.1:\d+$/);
const owner = "course-skill-updates-fixture";
const refs = ["Service orientation and customer service", "Marketing and media", "Reading, writing and mathematics"].map((core_skill, i) => ({ wef_skill_id: i + 1, core_skill }));
const slugs = ["service-orientation-and-customer-service", "marketing-and-media", "reading-writing-and-mathematics"];
const role = snapshotRole({ occupation_code: "3332", title: "Conference and Event Planners", skills: [{ skill_id: 1, skill_slug: slugs[0], name: refs[0].core_skill }], tasks: ["Meeting with clients to discuss their needs;"] });
const courses = refs.map((ref, i) => snapshotCourse({ course_id: `WEF-${i + 1}-B-01`, title: `Synthetic course ${i + 1}`, skill_id: slugs[i], outcomes: "Understand the principles and practise the course exercises", chapter_count: 1, chapters: [{ order: 1, title: "Full course" }] }, ref.core_skill));
let workspace = {
  "aiwrevolusi.possibilities.chosenDirection": JSON.stringify({ occupation_code: "3332" }),
  "aiwrevolusi.courseLibrary.v1": JSON.stringify({ version: 1, workContext: "", skillId: "", saved: [courses[0].course_id], choices: {}, basis: {}, pending: [] }),
};
let revision = 0;
const requests = [], errors = [];
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20000);
page.on("pageerror", error => errors.push(error.message));
const json = (route, body) => route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
await page.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin && !["blob:", "data:"].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith("/api/v1/")) return route.continue();
  const endpoint = url.pathname.slice("/api/v1".length);
  if (endpoint === "/account/me") return json(route, { id: owner, username: owner });
  if (endpoint === "/account/workspace") {
    if (request.method() === "PATCH") { const body = request.postDataJSON(); workspace = body.data; revision++; }
    return json(route, { owner_id: owner, data: workspace, revision });
  }
  if (endpoint === "/reference/wef-skills") return json(route, refs);
  if (endpoint === "/possibilities/3332/requirements") return json(route, role);
  if (endpoint === "/learning/courses") return json(route, { found: true, courses });
  if (endpoint === "/learning/progress") return json(route, { chapters: [{ course_id: courses[0].course_id, skill_id: slugs[0], chapter_index: 0, value: 10 }, { course_id: courses[1].course_id, skill_id: slugs[1], chapter_index: 0, value: 4 }] });
  if (endpoint === "/resume/capabilities") return json(route, { ai_configured: true, rendercv_version: "2.8" });
  if (endpoint === "/resume/recommend-courses") return json(route, { courses: [] });
  if (["/resume/generate", "/resume/render"].includes(endpoint)) {
    if (endpoint === "/resume/generate") requests.push(request.postDataJSON());
    const response = await route.fetch({ url: backend + url.pathname, headers: { ...request.headers(), "X-Resume-QA-Role": JSON.stringify(role), "X-Resume-QA-Scenario": "ok" } });
    return route.fulfill({ response });
  }
  return json(route, {});
});
const saved = () => page.getByText("Saved on this device", { exact: true }).waitFor();
const pdfReady = () => page.waitForFunction(() => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === "PDF" && !button.disabled));
const read = () => page.evaluate(owner => new Promise((resolve, reject) => {
  const request = indexedDB.open("aiwrevolusi.resume.local.v1", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, tx = db.transaction("drafts", "readonly"), get = tx.objectStore("drafts").get(owner); tx.oncomplete = () => { resolve(get.result); db.close(); }; };
}), owner);
const generate = async first => {
  await page.getByRole("button", { name: first ? "Generate my resume" : "Generate new suggestions", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Tailor for another role?" });
  if (await confirmation.isVisible()) await confirmation.getByRole("button", { name: "Generate suggestions", exact: true }).click();
  await page.getByRole("dialog", { name: "Review AI suggestions" }).waitFor();
  await saved();
};
try {
  await page.goto(origin + "/career/possibilities/resume");
  await page.getByRole("button", { name: "Generate my resume", exact: true }).waitFor();
  let importNavigations = 0;
  const duringImport = frame => { if (frame === page.mainFrame()) importNavigations++; };
  page.on("framenavigated", duringImport);
  await page.getByLabel("Upload original resume PDF or DOCX").setInputFiles(process.env.AIW_QA_SOURCE_PDF || { name: "original.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docxFixture(["Synthetic Person", "Skills", refs[0].core_skill, "SQL", "Experience", "Prepared 12 reports."]) });
  const sourceSkills = page.getByLabel("Skills explicitly listed in your original resume"); await sourceSkills.waitFor();
  page.off("framenavigated", duringImport);
  assert.equal(importNavigations, 0, "First upload must not reload away unsaved source details");
  const originals = (await sourceSkills.inputValue()).split("\n");
  await generate(true); await applyReviewedResume(page); await saved(); await pdfReady();
  const initial = (await read()).document;
  assert.equal((await read()).skillFilterVersion, "all_sources_v1");
  assert.equal(await page.locator(".rb-pending-skills").count(), 0);
  // Simulate courses saved in the account while its local resume remains unchanged.
  workspace["aiwrevolusi.courseLibrary.v1"] = JSON.stringify({ ...JSON.parse(workspace["aiwrevolusi.courseLibrary.v1"]), saved: courses.map(course => course.course_id) });
  await page.reload();
  const pending = page.locator(".rb-pending-skills");
  await pending.getByRole("button", { name: "Review skill updates" }).waitFor();
  assert.match(await pending.innerText(), /2 skills/);
  assert.deepEqual((await read()).document, initial);
  await pending.getByRole("button", { name: "Review skill updates" }).click();
  const summary = page.getByRole("region", { name: "Combined resume skills" });
  assert.match(await summary.innerText(), /3 skills from 3 saved courses/);
  await summary.getByText("View combined skills", { exact: true }).click();
  for (const name of [refs[1].core_skill, refs[2].core_skill]) assert.match(await summary.getByRole("listitem").filter({ hasText: name }).innerText(), /Not yet applied/);
  await generate(false);
  assert.deepEqual((await read()).document, initial, "Generating does not apply an unreviewed Skills chapter");
  const submitted = requests.at(-1);
  assert.equal(submitted.skill_selection, "aggregate");
  for (const name of [...originals, ...refs.map(skill => skill.core_skill)]) assert.ok(submitted.skills.some(skill => skill.name === name), name);
  assert.equal(submitted.skills.length, new Set(submitted.skills.map(skill => skill.name)).size);
  await applyReviewedResume(page); await saved(); await pdfReady();
  const updated = (await read()).document;
  assert.deepEqual(new Set(updated.cv.sections.Skills.map(entry => entry.bullet)), new Set(submitted.skills.map(skill => skill.name)));
  assert.equal(await pending.count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await saved();
  await pending.waitFor(); assert.deepEqual((await read()).document, initial);
  await page.getByRole("button", { name: "Redo", exact: true }).click(); await saved();
  assert.equal(await pending.count(), 0);
  await page.reload(); await pdfReady(); assert.equal(await pending.count(), 0);
  await page.getByRole("button", { name: "Target role", exact: true }).click();
  assert.match(await summary.innerText(), /All skills from these sources are already/);
  const out = fileURLToPath(new URL("../../.local/resume-qa/course-skill-updates/", import.meta.url)); await mkdir(out, { recursive: true });
  await summary.getByText("View combined skills", { exact: true }).click();
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/desktop.png", fullPage: true, animations: "disabled" });
  await summary.screenshot({ path: out + "/combined-skills.png", animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/mobile.png", fullPage: true, animations: "disabled" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log("PASS: saved-course skills survive import, generation, apply, reload, undo/redo and PDF refresh; pending updates are visible.");
} catch (error) { console.error(await page.locator("body").innerText()); throw error; }
finally { await page.unrouteAll({ behavior: "wait" }); await browser.close(); }
