/** Offline browser acceptance: synthetic accounts/reference data/AI; no live user data. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AIW_QA_ORIGIN || "http://127.0.0.1:5186";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const output = fileURLToPath(new URL("../../.local/resume-qa/target-role", import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.AIW_QA_BROWSER_CHANNEL || "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); page.setDefaultTimeout(20000);
const directionKey = "aiwrevolusi.possibilities.chosenDirection";
// The 2421 fixture uses the four skills verified in the installed database reference map.
const roleA = { occupation_code: "2421", title: "Management and Organization Analysts", skills: [
  { skill_id: 1, skill_slug: "analytical-thinking", name: "Analytical thinking" },
  { skill_id: 10, skill_slug: "service-orientation-and-customer-service", name: "Service orientation and customer service" },
  { skill_id: 21, skill_slug: "reading-writing-and-mathematics", name: "Reading, writing and mathematics" },
  { skill_id: 24, skill_slug: "manual-dexterity-endurance-and-precision", name: "Manual dexterity, endurance and precision" },
] };
const roleB = { occupation_code: "2512", title: "Software developers", skills: [
  { skill_id: 3, skill_slug: "programming", name: "Programming" },
  { skill_id: 4, skill_slug: "sql", name: "SQL" },
] };
const roleEmpty = { occupation_code: "9998", title: "Empty role", skills: [] };
const roles = [roleA, roleB, roleEmpty];
const requirements = role => [role.title, "Required skills:", ...role.skills.map(skill => `- ${skill.name}`)].join("\n");
const personal = { "aiwrevolusi.learningSkills.v1": JSON.stringify([{ id: "sql", name: "SQL" }]) };
let owner = "target-account-a", workspace = { ...personal }, revision = 0, saveFailure = false, roleFailure = false, roleGate = null, generationGate = null;
const generated = [], pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== origin && !["blob:", "data:"].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  const path = url.pathname.replace("/api/v1", "");
  if (path === "/account/me") return json(route, { id: owner, email: "synthetic@example.test", full_name: "Synthetic target account" });
  if (path === "/account/workspace") {
    if (request.method() === "PATCH") {
      if (saveFailure) return json(route, { detail: "Synthetic save failure" }, 503);
      const body = request.postDataJSON(); workspace = body.data; revision = body.revision + 1;
    }
    return json(route, { owner_id: owner, data: workspace, revision });
  }
  if (path === "/reference/wef-skills") return json(route, [{ wef_skill_id: 4, core_skill: "SQL" }]);
  if (path === "/resume/capabilities") return json(route, { ai_configured: true, rendercv_version: "2.8" });
  if (path === "/possibilities") return json(route, {
    contract_version: "2", source: "live", status: "ready", disclaimer: "Exploratory connections, not job readiness.",
    current_role: { occupation_code: "1111", title: "Current role" }, skills: [],
    directions: roles.slice(0, 2).map(role => ({ ...role, description: "Synthetic career reference", area: null, coverage_pct: 0,
      skills: role.skills.map(skill => ({ ...skill, state: "missing" })), requirements: [], occupation_uri: null, source: null })),
    chosen_direction_code: workspace[directionKey] ? JSON.parse(workspace[directionKey]).occupation_code : null,
    shortlisted_skill_ids: [], reviewed_esco_skills: [],
  });
  const match = path.match(/^\/possibilities\/([^/]+)\/requirements$/);
  if (match) {
    const role = roles.find(value => value.occupation_code === match[1]);
    if (roleGate) await roleGate;
    if (roleFailure) return json(route, { detail: "Synthetic role reference failure" }, 503);
    return role ? json(route, role) : json(route, { detail: "This target role is no longer available. Choose another career direction." }, 404);
  }
  if (path === "/resume/generate") {
    const input = request.postDataJSON(); generated.push(input);
    if (generationGate) await generationGate;
    return json(route, { skill_filter_version: "role_relevance_v1", sections: [{ title: "Skills", entries: [{ text: "Understanding SQL", skill_ids: input.skills.map(skill => skill.id), fact_ids: [] }] }], gaps: [] });
  }
  return json(route, { detail: "Offline QA endpoint unavailable" }, 503);
});
const ready = () => page.waitForFunction(() => document.querySelector(".rb-job-card") || document.querySelector(".rw-workbench"));
const saved = () => page.getByText("Saved on this device", { exact: true }).waitFor();
const choose = async role => {
  const card = page.locator(".px-direction-card").filter({ has: page.getByRole("heading", { name: role.title, exact: true }) });
  await card.getByRole("button", { name: /Explore this direction|Chosen direction/ }).click();
};
const roleShown = role => page.locator(".rb-target-role").getByRole("heading", { name: role.title, exact: true }).waitFor();
const readDraft = () => page.evaluate(owner => new Promise((resolve, reject) => {
  const request = indexedDB.open("aiwrevolusi.resume.local.v1", 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, tx = db.transaction("drafts", "readonly"), read = tx.objectStore("drafts").get(owner); tx.oncomplete = () => { resolve(read.result); db.close(); }; };
}), owner);
const reenter = async code => {
  if (code) workspace[directionKey] = JSON.stringify({ occupation_code: code }); else delete workspace[directionKey];
  await page.reload(); await ready();
};
try {
  await page.goto(`${origin}/career/possibilities`);
  const cta = page.getByRole("button", { name: "Generate resume", exact: true });
  await cta.waitFor(); assert.equal(await cta.isDisabled(), true);
  await page.getByText("Select a career direction to continue", { exact: true }).waitFor();
  await page.locator(".px-companion-cta").evaluate(element => element.click());
  await page.locator(".px-companion").evaluate(element => { element.tabIndex = -1; element.focus(); });
  await page.locator(".px-companion-cta").evaluate(element => element.focus());
  assert.equal(await page.locator(".px-companion-cta").evaluate(element => document.activeElement === element), false, "Disabled button cannot receive keyboard focus");
  await page.keyboard.press("Enter"); assert.equal(page.url(), `${origin}/career/possibilities`);
  await choose(roleA); assert.equal(await cta.isEnabled(), true);
  assert.equal(await page.getByRole("button", { name: "Add to Skill Path", exact: true }).isDisabled(), true);
  saveFailure = true; await cta.click();
  await page.getByRole("alert").filter({ hasText: "Synthetic save failure" }).first().waitFor();
  assert.equal(page.url(), `${origin}/career/possibilities`, "Save failure blocks navigation");
  saveFailure = false; await cta.click(); await page.waitForURL(`${origin}/career/possibilities/resume`); await ready(); await roleShown(roleA); await saved();
  assert.deepEqual(await page.locator(".rb-target-skills li").allTextContents(), roleA.skills.map(skill => skill.name));
  assert.equal(await page.getByLabel("Target job requirements · required").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Use an example", exact: true }).count(), 0);
  assert.equal(generated.length, 0, "Entering never calls AI automatically");
  await page.screenshot({ path: `${output}/selected-role-desktop.png`, fullPage: true });
  await page.reload(); await ready(); await roleShown(roleA); await saved();
  await page.getByRole("button", { name: "Generate my resume", exact: true }).click();
  await page.locator(".rw-workbench").waitFor(); await saved();
  assert.equal(generated[0].job_requirements, requirements(roleA));
  assert.deepEqual(generated[0].skills.map(skill => skill.name), ["SQL"], "Role requirements do not seed user skills");
  const original = await readDraft(); assert.equal(original.jobRequirements, requirements(roleA));
  await page.locator(".rb-workbench-target").getByRole("link", { name: "Change target role" }).click();
  await page.waitForURL(`${origin}/career/possibilities`); await choose(roleB); await cta.click();
  await page.waitForURL(`${origin}/career/possibilities/resume`); await ready(); await saved();
  await page.locator(".rb-workbench-target").getByText(/not yet been tailored/).waitFor();
  const pending = await readDraft(); assert.deepEqual(pending.document, original.document);
  assert.equal(pending.jobRequirements, requirements(roleA)); assert.equal(pending.pendingJobRequirements, requirements(roleB));
  await page.getByRole("button", { name: "Target role", exact: true }).click(); await roleShown(roleB);
  await page.getByRole("button", { name: "Generate new suggestions", exact: true }).click();
  await page.getByRole("dialog", { name: "Tailor for another role?" }).getByRole("button", { name: "Generate suggestions", exact: true }).click();
  const proposal = page.getByRole("dialog", { name: "Review AI suggestions" }); await proposal.waitFor();
  assert.equal((await readDraft()).jobRequirements, requirements(roleA), "Unapplied suggestions keep interview target unchanged");
  await proposal.getByRole("checkbox").check(); await proposal.getByRole("button", { name: "Apply selected chapters", exact: true }).click(); await saved();
  assert.equal((await readDraft()).jobRequirements, requirements(roleB));
  await page.getByRole("button", { name: "Undo", exact: true }).click(); await saved();
  const undone = await readDraft(); assert.equal(undone.jobRequirements, requirements(roleA));
  assert.equal(undone.pendingJobRequirements, requirements(roleB)); assert.equal(undone.targetRole.occupation_code, roleB.occupation_code);
  await page.getByRole("button", { name: "Target role", exact: true }).click(); await roleShown(roleB);
  let releaseGenerate; generationGate = new Promise(resolve => { releaseGenerate = resolve; });
  await page.getByRole("button", { name: "Generate new suggestions", exact: true }).click();
  await page.getByRole("dialog", { name: "Tailor for another role?" }).getByRole("button", { name: "Generate suggestions", exact: true }).click();
  await page.getByRole("button", { name: "Polishing your resume…", exact: true }).waitFor();
  await page.locator(".rb-target-role").getByRole("link", { name: "Change target role" }).click();
  await page.waitForURL(`${origin}/career/possibilities`); await choose(roleA); releaseGenerate(); generationGate = null; await cta.click();
  await page.waitForURL(`${origin}/career/possibilities/resume`); await ready(); await saved();
  assert.equal((await readDraft()).proposal, null, "Late generation cannot write an old target proposal");
  // Missing target preserves an existing document and disables every generation path.
  await reenter(null); await page.locator(".rb-workbench-target").getByText(/Select a career direction/).waitFor();
  assert.ok((await readDraft()).document); await page.getByRole("button", { name: "Target role", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Generate new suggestions", exact: true }).isDisabled(), true);
  await page.keyboard.press("Escape");
  // Account isolation and errors for first-use without a draft.
  owner = "target-account-b"; workspace = { ...personal }; await page.reload(); await ready();
  await page.locator(".rb-target-role").getByText(/Select a career direction/).waitFor();
  assert.equal(await page.locator(".rw-workbench").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Generate my resume", exact: true }).isDisabled(), true);
  await reenter("unknown"); await page.getByRole("alert").filter({ hasText: "no longer available" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Generate my resume", exact: true }).isDisabled(), true);
  await reenter(roleEmpty.occupation_code); await roleShown(roleEmpty); await page.getByText(/No required skills are available/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Generate my resume", exact: true }).isDisabled(), true);
  roleFailure = true; await reenter(roleA.occupation_code); await page.getByRole("alert").filter({ hasText: "Synthetic role reference failure" }).waitFor();
  roleFailure = false; await page.getByRole("button", { name: "Retry role requirements", exact: true }).click(); await roleShown(roleA); await saved();
  // A role response arriving after account change never populates that account.
  let releaseRole; roleGate = new Promise(resolve => { releaseRole = resolve; }); await reenter(roleB.occupation_code);
  await page.getByText("Loading your target role's required skills…", { exact: true }).waitFor();
  owner = "target-account-c"; workspace = {}; await page.reload(); await ready(); releaseRole(); roleGate = null;
  await page.locator(".rb-target-role").getByText(/Select a career direction/).waitFor();
  assert.equal(await page.locator(".rb-target-skills li").count(), 0); assert.equal(await readDraft(), undefined);
  // Restore selected role on a small screen and verify no horizontal overflow.
  await reenter(roleA.occupation_code); await roleShown(roleA); await saved();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/selected-role-mobile.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  assert.deepEqual(pageErrors, []);
  console.log("PASS: disabled/no-skill selection, save failure, role handoff/reload, full required skills without fabricated abilities, generation/application/undo, stale generation/account responses, existing draft preservation, missing/unknown/empty/error/retry states, mobile overflow.");
} finally { await browser.close(); }
