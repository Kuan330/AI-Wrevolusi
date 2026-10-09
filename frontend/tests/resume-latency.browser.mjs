/** Synthetic-only browser QA: insurance pollution, fallback, cancel, old drafts and PDF. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir,readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { docxFixture } from "./resume-fixtures.mjs";
const {chromium}=createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE||"playwright");
const origin=process.env.AIW_QA_ORIGIN||"http://127.0.0.1:5186",backend="http://127.0.0.1:8016";
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const output=fileURLToPath(new URL("../../.local/resume-qa/skills-latency",import.meta.url));await mkdir(output,{recursive:true});
const sample=["Alex Example","Core Skills","•Sales & Advisory:Needs analysis, cross-selling, policy renewals, lead generation","•Product Knowledge:Life, medical, motor, property, and travel insurance","•Compliance:Underwriting guidelines, KYC/AML, claims documentation","•Soft Skills:Negotiation, active listening, client retention, objection handling","•Tools:Salesforce, Microsoft Office, CRM systems","Professional Experience","Insurance Sales Representative Jan 2021 – Present","ABC Insurance Berhad, Kuala Lumpur","•Manage a portfolio of 250+ clients, achieving a 92% policy renewal rate","•Exceeded annual sales quota by 18% for three consecutive years","Customer Service Associate Jun 2018 – Dec 2020","XYZ Financial Services, Petaling Jaya","Education","University of Malaya","Projects","Retail Sales Analysis | Apr 2026","• Cleaned 2,400 records.","• Removed 36 duplicates.","Student Survey Review | Nov 2025","• Reviewed 180 responses.","Licenses & Certifications","Original license wording"];
const owner="resume-latency-synthetic",role={occupation_code:"2421",title:"Management and Organization Analysts",skills:[{skill_id:9,skill_slug:"analytical-thinking",name:"Analytical thinking"}]};
const secondRole={occupation_code:"2422",title:"Synthetic New Target Role",skills:[{skill_id:3,skill_slug:"programming",name:"Programming"}]};
let scenario="ok",revision=0;
let workspace={"aiwrevolusi.possibilities.chosenDirection":JSON.stringify({occupation_code:"2421"}),"aiwrevolusi.learningSkills.v1":JSON.stringify([{id:"ai-and-big-data",name:"AI and big data",source:"wef"},{id:"everyday-english-1",name:"Everyday English 1"}]),"aiwrevolusi.courseLibrary.v1":JSON.stringify({version:1,workContext:"",skillId:"",saved:["english"],choices:{},basis:{},pending:[]})};
const browser=await chromium.launch({headless:true,channel:process.env.AIW_QA_BROWSER_CHANNEL||"chrome"});
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(25000);
const errors=[],generated=[];page.on("pageerror",e=>errors.push(e.message));
const json=(route,body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
await context.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url());if(url.origin!==origin&&!['blob:','data:'].includes(url.protocol))return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();const path=url.pathname.replace('/api/v1','');
  if(path==='/account/me')return json(route,{id:owner,email:'synthetic@example.test',full_name:'Synthetic account'});
  if(path==='/account/workspace'){if(req.method()==='PATCH'){const data=req.postDataJSON();workspace=data.data;revision=data.revision+1;}return json(route,{owner_id:owner,data:workspace,revision});}
  if(path==='/resume/capabilities')return json(route,{ai_configured:true,rendercv_version:'2.8'});
  if(path==='/reference/wef-skills')return json(route,[{wef_skill_id:1,core_skill:'AI and big data'},{wef_skill_id:2,core_skill:'Reading, writing and mathematics'}]);
  if(path==='/learning/courses')return json(route,{found:true,courses:[{course_id:'english',skill_id:'reading-writing-and-mathematics',title:'Everyday English 1'}]});
  if(path==='/possibilities/2421/requirements')return json(route,role);
  if(path==='/possibilities/2422/requirements')return json(route,secondRole);
  if(path==='/resume/recommend-courses')return json(route,{courses:[]});
  if(path==='/resume/generate'){generated.push(req.postDataJSON());const response=await route.fetch({url:backend+url.pathname,headers:{...req.headers(),'X-Resume-QA-Scenario':scenario,'X-Resume-QA-Role':JSON.stringify(req.postDataJSON().occupation_code===secondRole.occupation_code?secondRole:role)}});return route.fulfill({response});}
  if(path==='/resume/render'){const response=await route.fetch({url:backend+url.pathname});return route.fulfill({response});}
  return json(route,{detail:'Synthetic endpoint unavailable'},503);
});
const saved=()=>page.getByText('Saved on this device',{exact:true}).waitFor();
const readDraft=()=>page.evaluate(owner=>new Promise((resolve,reject)=>{const open=indexedDB.open('aiwrevolusi.resume.local.v1',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readonly'),read=tx.objectStore('drafts').get(owner);tx.oncomplete=()=>{resolve(read.result);db.close();};};}),owner);
const target=async()=>{await page.getByRole('button',{name:'Target role',exact:true}).click();await page.getByRole('heading',{name:'Bring your existing resume',exact:true}).waitFor();};
const start=async()=>{await page.getByRole('button',{name:'Generate new suggestions',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Tailor for another role?'});if(await dialog.count())await dialog.getByRole('button',{name:'Generate suggestions',exact:true}).click();};
try{
  await page.goto(origin+'/career/possibilities/resume');
  assert.equal(await page.getByLabel('Skills included in your resume',{exact:true}).count(),0);
  await page.getByLabel('Upload original resume PDF or DOCX').setInputFiles({name:'insurance-synthetic.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docxFixture(sample)});
  const skillField=page.getByLabel(/Skills explicitly listed/);await skillField.waitFor();
  const extracted=await skillField.inputValue();assert.ok(extracted.includes('Salesforce')&&extracted.includes('Life, medical, motor, property, and travel insurance'));assert.ok(!/Jaya|Berhad|92%|Professional Experience/.test(extracted));
  await page.getByText('I have reviewed this text and removed',{exact:false}).click();
  const started=Date.now();await page.getByRole('button',{name:'Generate my resume',exact:true}).click();await page.locator('.rw-workbench').waitFor();await saved();
  const first=await readDraft();assert.equal(first.generationOutcome,'tailored');assert.ok(Date.now()-started<10000);
  const names=generated[0].skills.map(s=>s.name);assert.ok(names.includes('AI and big data')&&names.includes('Reading, writing and mathematics'));assert.ok(!names.includes('Everyday English 1')&&!names.includes('Analytical thinking')&&!names.includes('Petaling Jaya'));assert.ok(!names.some(s=>s.includes('92%')));
  assert.ok(JSON.stringify(first.document.cv.sections.Experience).includes('92%'));assert.equal(first.document.cv.sections.Projects[0].name,'Retail Sales Analysis');assert.equal(first.document.cv.sections.Projects[0].date,'Apr 2026');assert.ok(first.document.cv.sections['Licenses & Certifications'].includes('Original license wording'));
  assert.equal(first.document.cv.sections.Skills.length,names.length);
  assert.deepEqual(new Set(first.document.cv.sections.Skills.map(entry=>entry.bullet)),new Set(names));
  assert.ok(first.document.cv.sections.Skills.some(entry=>entry.bullet==='Reading, writing and mathematics'));
  // Legacy automatic extraction is migrated only for the next input, not the applied CV.
  await page.evaluate(owner=>new Promise((resolve,reject)=>{const open=indexedDB.open('aiwrevolusi.resume.local.v1',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),read=store.get(owner);read.onsuccess=()=>{const draft=read.result;draft.source.skills=['Petaling Jaya','achieving a 92% policy renewal rate'];delete draft.source.skillsParserVersion;delete draft.source.skillsOrigin;store.put(draft,owner);};tx.oncomplete=()=>{db.close();resolve();};};}),owner);
  await page.reload();await page.locator('.rw-workbench').waitFor();assert.deepEqual((await readDraft()).document,first.document);await target();assert.ok(!(await skillField.inputValue()).includes('Petaling Jaya'));
  // Provider failure gives an honest, reviewable fallback and keeps the applied target.
  scenario='unavailable';await start();const proposal=page.getByRole('dialog',{name:'Review AI suggestions'});await proposal.waitFor();await proposal.getByText('AI polishing was unavailable.',{exact:false}).waitFor();
  let draft=await readDraft();assert.equal(draft.proposal.outcome,'source_preserved');assert.deepEqual(draft.document,first.document);assert.equal(draft.proposal.sections.find(s=>s.title==='Projects').entries[0].project.date,'Apr 2026');
  assert.deepEqual(new Set(draft.proposal.sections.find(s=>s.title==='Skills').entries.map(e=>e.text)),new Set(generated.at(-1).skills.filter(s=>role.skills.some(r=>r.name.toLowerCase()===s.name.toLowerCase())).map(s=>s.name)));
  for(const checkbox of await proposal.getByRole('checkbox').all())await checkbox.check();await proposal.getByRole('button',{name:'Apply selected chapters',exact:true}).click();await saved();draft=await readDraft();assert.equal(draft.jobRequirements,first.jobRequirements);assert.equal(draft.generationOutcome,'source_preserved');await page.getByText('AI polishing was unavailable.',{exact:false}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'PDF',exact:true}).click();const download=await downloadPromise;await download.saveAs(output+'/source-preserved.pdf');const pdf=await readFile(await download.path());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');await page.screenshot({path:output+'/source-preserved.png',fullPage:true});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await saved();assert.equal((await readDraft()).generationOutcome,'tailored');assert.deepEqual((await readDraft()).document,first.document);
  // Generation-specific progress is indeterminate, accessible and responsive.
  const checkProgress=async()=>{
    const progress=page.getByRole('progressbar',{name:'Tailoring your resume',exact:true});
    await progress.waitFor();
    await page.getByRole('button',{name:'Cancel generation',exact:true}).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(await progress.getAttribute('aria-valuenow'),null);
    assert.equal(await progress.getAttribute('aria-valuetext'),null);
    assert.equal(await page.getByText('Polishing reviewed facts…',{exact:false}).count(),0);
    assert.equal(await page.locator('.rb-generation-elapsed').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.rb-generation-progress-heading [role="status"]').textContent(),'Tailoring your resume');
    await page.screenshot({path:output+'/desktop-progress.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Cancel generation',exact:true}).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.rb-generation-indicator').evaluate(el=>getComputedStyle(el).animationName),'none');
    const width=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(width.content<=width.viewport);
    await page.screenshot({path:output+'/mobile-progress.png',fullPage:true});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:1440,height:1100});
  };
  // A different target's fallback must not overwrite the already-applied interview target.
  await target();scenario='progress';const calls=generated.length;await start();await page.getByRole('button',{name:'Polishing your resume…',exact:true}).waitFor();await checkProgress();await page.getByRole('button',{name:'Cancel generation',exact:true}).click();await page.getByText('Generation cancelled.',{exact:false}).waitFor();await page.waitForTimeout(2300);assert.equal(generated.length,calls+1);assert.equal((await readDraft()).proposal,null);assert.deepEqual((await readDraft()).document,first.document);
  scenario='ok';await start();await proposal.waitFor();assert.equal((await readDraft()).proposal.outcome,'tailored');await proposal.getByRole('button',{name:'Keep current resume',exact:true}).click();
  scenario='invalid';await start();await proposal.waitFor();await proposal.getByText('AI polishing could not be fully verified.',{exact:false}).waitFor();assert.equal((await readDraft()).proposal.outcome,'source_preserved');await proposal.getByRole('button',{name:'Keep current resume',exact:true}).click();
  // Failed tailoring for a newly selected role cannot replace the applied interview target.
  workspace["aiwrevolusi.possibilities.chosenDirection"]=JSON.stringify({occupation_code:"2422"});
  await page.reload();await page.locator('.rw-workbench').waitFor();await target();scenario='unavailable';await start();await proposal.waitFor();
  assert.equal((await readDraft()).proposal.outcome,'source_preserved');
  for(const checkbox of await proposal.getByRole('checkbox').all())await checkbox.check();
  await proposal.getByRole('button',{name:'Apply selected chapters',exact:true}).click();await saved();
  const differentTarget=await readDraft();assert.equal(differentTarget.jobRequirements,first.jobRequirements);assert.ok(differentTarget.pendingJobRequirements.startsWith(secondRole.title));
  assert.ok(!generated.at(-1).skills.some(skill=>skill.name==='Programming'));
  await page.locator('.rb-workbench-target').getByText('Your existing resume has not yet been tailored to this target role.',{exact:false}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:output+'/mobile-workbench.png',fullPage:true});assert.equal(await page.getByLabel('Skills included in your resume',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);console.log('PASS: insurance extraction, legacy migration, canonical course skills, source-preserved apply/undo/export, single-call cancel/retry, invalid-output fallback and applied target isolation');
}catch(error){console.error('DIAGNOSTIC',JSON.stringify({errors,generated:generated.length,notices:await page.locator('.rb-error,.rb-warning').allTextContents()}));await page.screenshot({path:output+'/failure.png',fullPage:true});throw error;}finally{await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
