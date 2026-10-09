/** End-to-end local QA: synthetic accounts, real generation validation/assembly and PDF renderer. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { docxFixture } from "./resume-fixtures.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.AIW_QA_ORIGIN || "http://127.0.0.1:5186", backend = "http://127.0.0.1:8016";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const output = fileURLToPath(new URL("../../.local/resume-qa/skills-projects", import.meta.url));
await mkdir(output, { recursive: true });
const sample = ["Alex Example", "alex@example.test", "Skills", "Excel, SQL, Data cleaning, Data validation", "Analytical thinking, Attention to detail, Communication, Teamwork", "Projects", "Retail Sales Analysis | Apr 2026", "• University project using a synthetic retail dataset.", "• Cleaned 2,400 transaction records in Excel, corrected dates and removed 36 duplicates.", "• Used SQL joins and aggregations to compare monthly sales by product category.", "• Prepared pivot tables and charts, and presented three findings to a four-person team.", "Student Survey Data Quality Review | Nov 2025", "• Reviewed 180 anonymous survey responses for missing values and inconsistent labels.", "• Documented cleaning rules and prepared a one-page participation summary."];
const role = { occupation_code: "2421", title: "Management and Organization Analysts", skills: [{ skill_id: 1, skill_slug: "analytical-thinking", name: "Analytical thinking" }, { skill_id: 10, skill_slug: "service-orientation-and-customer-service", name: "Service orientation and customer service" }] };
const reference = ["Analytical thinking", "Creative thinking", "Programming", "Leadership and social influence", "Service orientation and customer service"].map((core_skill, i) => ({wef_skill_id: i + 1, core_skill}));
const at = "2026-10-01T00:00:00Z";
const goal = {id:"goal-1",sourceKey:"personal:writing",createdAt:at,initial:{skill:{source:"personal",id:"writing",label:"Write reports",sourceVersion:null},decision:null,tasks:[],occupationCode:null,sourceOccupationUri:null,career:null,origin:"browse",workKey:null,wording:"Write reports"},wording:"Write reports",action:null,attempts:[],history:[],revision:1,needsReview:false,updatedAt:at};
const base = {
  "aiwrevolusi.possibilities.chosenDirection": JSON.stringify({occupation_code:"2421"}),
  "aiwrevolusi.learningSkills.v1": JSON.stringify([{id:"analytical-thinking",name:"Analytical thinking"},{id:"creative-thinking",name:"Creative thinking"}]),
  "aiwrevolusi.learningGoals.v1": JSON.stringify({version:1,goals:[goal]}),
  "aiwrevolusi.courseLibrary.v1": JSON.stringify({version:1,workContext:"",skillId:"",saved:["saved"],choices:{},basis:{},pending:[{courseId:"planned",addedAt:at,choice:{chapters:[],weekdays:[],minutesPerDay:30}}]}),
};
let owner = "skills-projects-a", workspace = {...base}, revision = 0, catalogueFailure = false, releaseGenerate = null, generationGate = null;
const browser = await chromium.launch({headless:true,channel:process.env.AIW_QA_BROWSER_CHANNEL || "chrome"});
const context = await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const page = await context.newPage(); page.setDefaultTimeout(25000);
const errors = [], generated = []; page.on("pageerror", e => errors.push(e.message));
const json = (route, body, status = 200) => route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
await context.route("**/*", async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin !== origin && !["blob:","data:"].includes(url.protocol)) return route.abort();
  if (!url.pathname.startsWith("/api/")) return route.continue();
  const path = url.pathname.replace("/api/v1", "");
  if (path === "/account/me") return json(route,{id:owner,email:"synthetic@example.test",full_name:"Synthetic account"});
  if (path === "/account/workspace") { if(req.method()==="PATCH") {const data=req.postDataJSON();workspace=data.data;revision=data.revision+1;}return json(route,{owner_id:owner,data:workspace,revision}); }
  if (path === "/reference/wef-skills") return json(route,reference);
  if (path === "/resume/capabilities") return json(route,{ai_configured:true,rendercv_version:"2.8"});
  if (path === "/possibilities/2421/requirements") return json(route,role);
  if (path === "/learning/courses") return catalogueFailure ? json(route,{detail:"Synthetic catalogue failure"},503) : json(route,{found:true,courses:[{course_id:"saved",skill_id:"leadership-and-social-influence",title:"Never use course title as a skill"},{course_id:"planned",skill_id:"programming",title:"Programming course"}]});
  if (path === "/resume/generate") {generated.push(req.postDataJSON());if(generationGate)await generationGate;const response=await route.fetch({url:backend+url.pathname,headers:{...req.headers(),"X-Resume-QA-Role":JSON.stringify(role)}});return route.fulfill({response});}
  if (path === "/resume/render") {const response=await route.fetch({url:backend+url.pathname});return route.fulfill({response});}
  if (path === "/resume/recommend-courses") return json(route,{courses:[]});
  return json(route,{detail:"Offline endpoint unavailable"},503);
});
const saved = () => page.getByText("Saved on this device",{exact:true}).waitFor();
const readDraft = () => page.evaluate(owner => new Promise((resolve,reject)=>{const open=indexedDB.open("aiwrevolusi.resume.local.v1",1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction("drafts","readonly"),read=tx.objectStore("drafts").get(owner);tx.oncomplete=()=>{resolve(read.result);db.close();};};}),owner);
const openTarget = async () => {await page.getByRole("button",{name:"Target role",exact:true}).click();await page.getByRole("heading",{name:"Bring your existing resume",exact:true}).waitFor();};
try {
  await page.goto(origin+"/career/possibilities/resume");
  const skillPreview = page.getByLabel("Skills included in your resume",{exact:true});
  assert.equal(await skillPreview.count(),0);
  await page.getByRole("button",{name:"Generate my resume",exact:true}).waitFor();
  await page.getByLabel("Upload original resume PDF or DOCX").setInputFiles({name:"sample.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",buffer:docxFixture(sample)});
  await page.getByLabel("Projects from your reviewed source").getByText("Retail Sales Analysis",{exact:true}).waitFor();
  await page.getByText("I have reviewed this text and removed",{exact:false}).click();
  assert.ok((await page.getByLabel(/Skills explicitly listed/).inputValue()).includes("SQL"));
  await page.screenshot({path:output+"/reviewed-source.png",fullPage:true});
  await page.getByRole("button",{name:"Generate my resume",exact:true}).click();
  await page.locator(".rw-workbench").waitFor(); await saved();
  const first=await readDraft();
  const names=generated[0].skills.map(s=>s.name);
  for(const name of ["Excel","SQL","Data cleaning","Data validation","Analytical thinking","Attention to detail","Communication","Teamwork","Creative thinking","Leadership and social influence","Programming","Write reports"]) assert.ok(names.includes(name),name);
  assert.equal(names.length,12);assert.equal(generated[0].source_projects.length,2);
  assert.ok(generated[0].job_requirements.startsWith(role.title));assert.ok(!JSON.stringify(generated[0].evidence).includes("alex@example.test"));
  const skills=first.document.cv.sections.Skills.map(e=>e.bullet).join(", ");for(const name of names)assert.ok(skills.includes(name),name);
  assert.ok(!skills.includes("Service orientation"));
  const projects=first.document.cv.sections.Projects;
  assert.deepEqual(projects.map(p=>[p.name,p.date,p.highlights.length]),[["Retail Sales Analysis","Apr 2026",4],["Student Survey Data Quality Review","Nov 2025",2]]);
  assert.ok(projects[0].highlights[1].includes("2,400")&&projects[0].highlights[1].includes("36"));
  await page.getByRole("button",{name:"PDF",exact:true}).waitFor({state:"visible"});
  const pdfDownload=page.waitForEvent("download");await page.getByRole("button",{name:"PDF",exact:true}).click();const pdf=await pdfDownload;const pdfBytes=await readFile(await pdf.path());assert.ok(pdfBytes.subarray(0,4).equals(Buffer.from("%PDF")));await writeFile(output+"/generated.pdf",pdfBytes);await page.screenshot({path:output+"/generated-workbench.png",fullPage:true});
  await page.reload();await page.locator(".rw-workbench").waitFor();assert.deepEqual((await readDraft()).document,first.document);
  // Existing resume remains intact until reviewed suggestions are applied.
  await openTarget();await page.getByRole("button",{name:"Generate new suggestions",exact:true}).click();const proposal=page.getByRole("dialog",{name:"Review AI suggestions"});await proposal.waitFor();
  assert.deepEqual((await readDraft()).document,first.document);for (const checkbox of await proposal.getByRole("checkbox").all()) await checkbox.check();await proposal.getByRole("button",{name:"Apply selected chapters",exact:true}).click();await saved();
  await page.getByRole("button",{name:"Undo",exact:true}).click();await saved();assert.deepEqual((await readDraft()).document,first.document);
  // PDF import either restores structure or conservatively keeps project text, never invents it.
  await openTarget();await page.getByLabel("Upload original resume PDF or DOCX").setInputFiles({name:"generated.pdf",mimeType:"application/pdf",buffer:pdfBytes});await page.getByText("generated.pdf",{exact:true}).waitFor();
  const text=await page.getByLabel(/Resume evidence that AI will receive/).inputValue();assert.ok(text.includes("Retail Sales Analysis")&&text.includes("2,400")&&text.includes("Nov 2025"));
  // Ambiguous text is kept verbatim by the real backend.
  const raw="Projects\nMy ambiguous project details\nUsed SQL for 180 responses.";await page.getByLabel(/Resume evidence that AI will receive/).fill(raw);await page.getByText("I have reviewed this text and removed",{exact:false}).click();
  await page.getByRole("button",{name:"Generate new suggestions",exact:true}).click();await proposal.waitFor();const pending=await readDraft();const rawProjects=pending.proposal.sections.find(s=>s.title==="Projects");assert.deepEqual(rawProjects.entries.map(e=>e.text),raw.split("\n").slice(1));assert.ok(rawProjects.entries.every(e=>!e.project));
  await proposal.getByRole("checkbox",{name:"Projects",exact:true}).check();await proposal.getByRole("button",{name:"Apply selected chapters",exact:true}).click();await saved();assert.deepEqual((await readDraft()).document.cv.sections.Projects,raw.split("\n").slice(1));
  const rawDownload=page.waitForEvent("download");await page.getByRole("button",{name:"PDF",exact:true}).click();await rawDownload;
  await page.getByRole("button",{name:"Undo",exact:true}).click();await saved();assert.deepEqual((await readDraft()).document,first.document);await openTarget();
  // An unrelated refresh must not discard suggestions when the actual inputs are unchanged.
  await page.getByRole("button",{name:"Generate new suggestions",exact:true}).click();await proposal.waitFor();await page.evaluate(()=>window.dispatchEvent(new Event("workspace-change")));await saved();assert.ok((await readDraft()).proposal);assert.deepEqual((await readDraft()).document,first.document);await proposal.getByRole("button",{name:"Keep current resume",exact:true}).click();
  // Late AI completion after navigation/source changes cannot apply.
  generationGate=new Promise(resolve=>{releaseGenerate=resolve;});await page.getByRole("button",{name:"Generate new suggestions",exact:true}).click();await page.getByRole("button",{name:"Polishing your resume…",exact:true}).waitFor();workspace["aiwrevolusi.learningSkills.v1"]=JSON.stringify([{id:"creative-thinking",name:"Creative thinking"},{id:"new-selected-skill",name:"New selected skill",source:"custom"}]);await page.reload();releaseGenerate();generationGate=null;await page.locator(".rw-workbench").waitFor();assert.equal((await readDraft()).proposal,null);assert.deepEqual((await readDraft()).document,first.document);await openTarget();assert.equal(await skillPreview.count(),0);
  // Account-scoped directory failures block generation and recover on retry.
  owner="skills-projects-b";workspace={...base};catalogueFailure=true;await page.reload();await page.getByText("Synthetic catalogue failure",{exact:false}).waitFor();assert.equal(await page.getByRole("button",{name:"Generate my resume",exact:true}).isDisabled(),true);catalogueFailure=false;await page.getByRole("button",{name:"Retry skills",exact:true}).click();await page.getByRole("button",{name:"Generate my resume",exact:true}).waitFor();await page.getByRole("button",{name:"Generate my resume",exact:true}).waitFor();assert.equal(await page.getByRole("button",{name:"Generate my resume",exact:true}).isEnabled(),true);
  assert.equal((await readDraft()).document,null);assert.equal((await readDraft()).source,null);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:"passed",skills:names.length,projects:projects.length,realGenerationRequests:generated.length,pdfBytes:pdfBytes.length,scenarios:["DOCX","PDF","skill completeness","learning goals","saved/planned courses","review/apply/undo","refresh","verbatim fallback","stale AI","account isolation","catalogue retry"],output},null,2));
}catch(error){console.error('DIAGNOSTIC',JSON.stringify({errors,generated:generated.length,notices:await page.locator('.rb-error,.rb-warning').allTextContents()}));await page.screenshot({path:output+'/failure.png',fullPage:true});throw error;}finally{if(releaseGenerate)releaseGenerate();await context.unrouteAll({behavior:"ignoreErrors"});await browser.close();}
