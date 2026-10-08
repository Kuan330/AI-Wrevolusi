/** Production-build browser QA with synthetic accounts/AI and a real local renderer. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const {chromium}=createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE||"playwright");
const origin=process.env.AIW_QA_ORIGIN||"http://127.0.0.1:5186", renderer="http://127.0.0.1:8016";
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const output=fileURLToPath(new URL("../../.local/resume-qa",import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.AIW_QA_BROWSER_CHANNEL||"chrome"});
const context=await browser.newContext({viewport:{width:1536,height:1000},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[], sync=[], assistInputs=[], renderInputs=[];let owner="assistant-account-a",signedIn=true,assistGate=null,requests=0,lastPdf,courseRequests=0;
let workspace={"aiwrevolusi.learningSkills.v1":JSON.stringify([{id:"sql",name:"SQL"}]),"aiwrevolusi.courseLibrary.v1":JSON.stringify({version:1,workContext:"",skillId:"",saved:["course-3"],choices:{},basis:{},pending:[]})};
const json=(route,body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
page.on("pageerror",error=>errors.push(error.message));
await context.route("**/*",async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin!==origin&&!['blob:','data:'].includes(url.protocol))return route.abort();
 if(!url.pathname.startsWith("/api/"))return route.continue();
 const path=url.pathname.replace("/api/v1","");
 if(path==="/account/me")return json(route,signedIn?{id:owner,email:"synthetic@example.test",full_name:"Synthetic account"}:{detail:"Unauthenticated"},signedIn?200:401);
 if(path==="/account/workspace"){if(req.method()==="PATCH"){const body=req.postDataJSON();sync.push(body);workspace=body.data;return json(route,{owner_id:owner,data:workspace,revision:body.revision+1})}return json(route,{owner_id:owner,data:workspace,revision:0})}
 if(path==="/auth/logout"){signedIn=false;return json(route,null)}
 if(path==="/auth/refresh")return json(route,{detail:"Unauthenticated"},401);
 if(path==="/reference/wef-skills")return json(route,[{wef_skill_id:1,core_skill:"SQL"}]);
 if(path==="/resume/capabilities")return json(route,{ai_configured:true,ai_provider_host:"do-not-display.test",ai_model:"private-fixture",rendercv_version:"2.8"});
 if(path==="/learning/courses")return json(route,{found:true,courses:[1,2,3].map(i=>({course_id:`course-${i}`,skill_id:"analytical-thinking",title:`Practical data analysis ${i}`,provider:"Verified catalogue",level:i===2?"Intermediate":"Beginner",chapters:[{order:1,title:"Practice",duration_min:30}],chapter_count:1}))});
 if(path==="/resume/assist"){
  requests++;const input=req.postDataJSON();assistInputs.push({input,models:req.headers()["x-aiw-models"]});
  const body=JSON.stringify(input);for(const secret of ["Alex Doe","alex@example.test","PRIVATE CONTACT","https://alex.test"])assert.ok(!body.includes(secret));
  assert.ok(input.context_reviewed&&!input.document.cv.name&&!input.document.cv.email&&!input.mapping);
  if(assistGate)await assistGate;
  return json(route,{message:"Prepared concise wording and a theme change.",sections:[{section_index:0,entries:[{entry:{bullet:requests>1?"Understanding SQL":"Knowledge of SQL"},source_ids:["section-0-entry-0"]}]}],design:[{path:["theme"],value:"moderncv"}]});
 }
 if(path==="/resume/recommend-courses"){courseRequests++;return json(route,{courses:[]})}
 if(path==="/resume/render"){renderInputs.push(req.postDataJSON().document);const response=await route.fetch({url:`${renderer}/api/v1/resume/render`});if(response.status()===200)lastPdf=await response.body();return route.fulfill({response})}
 return json(route,{detail:"Offline fixture only"},503);
});
const copyright=()=>page.getByRole("button",{name:"© 2026 AI-Wrevolusi",exact:true});
const openDeveloper=async(p=page)=>{const button=p.getByRole("button",{name:"© 2026 AI-Wrevolusi",exact:true});await button.focus();for(let i=0;i<10;i++)await button.press("Enter");await p.getByRole("dialog",{name:"Developer settings"}).waitFor()};
const seed=async(p,draft)=>p.evaluate(async draft=>{await new Promise((resolve,reject)=>{const req=indexedDB.open("aiwrevolusi.resume.local.v1",1);req.onupgradeneeded=()=>req.result.createObjectStore("drafts");req.onsuccess=()=>{const db=req.result,tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").put(draft,draft.owner);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})},draft);
const pdfReady=async()=>{await page.getByRole("button",{name:"PDF",exact:true}).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='PDF'&&!button.disabled))};
const input=()=>page.getByRole("textbox",{name:"Ask AI to edit your resume"});
const doc={cv:{name:"Alex Doe",email:"alex@example.test",phone:"PRIVATE CONTACT",website:"https://alex.test",sections:{Skills:[{bullet:"SQL"}],Projects:[{name:"Data Project",summary:"Alex Doe built reports."}]}},design:{theme:"classic"},locale:{language:"english"},settings:{pdf_title:"My resume"}};
const draft={version:1,owner,revision:1,updatedAt:new Date().toISOString(),jobRequirements:"Use SQL to analyse data.",pendingJobRequirements:"Use SQL to analyse data.",document:doc,previewDocument:null,yamlText:JSON.stringify(doc),source:null,previous:null,proposal:null,gaps:[{id:"gap",label:"Analysis",keywords:["data"],skill_slugs:["analytical-thinking"]}],recommendations:[1,2,3,1].map(i=>({course_id:`course-${i}`,gap_ids:["gap"],reason:"Practice data analysis with guided exercises relevant to the target role."}))};
try{
 await page.goto(origin);await copyright().waitFor();
 for(let i=0;i<9;i++)await copyright().click();assert.equal(await page.getByRole("dialog",{name:"Developer settings"}).count(),0);
 await new Promise(resolve=>setTimeout(resolve,2100));await copyright().click();assert.equal(await page.getByRole("dialog",{name:"Developer settings"}).count(),0);
 for(let i=0;i<9;i++)await copyright().click();const dev=page.getByRole("dialog",{name:"Developer settings"});await dev.waitFor();
 await dev.getByLabel("Model ID priority 1").fill("model-a");await dev.getByRole("button",{name:"Add model",exact:true}).click();await dev.getByLabel("Model ID priority 2").fill("model-a");await dev.getByRole("button",{name:"Apply",exact:true}).click();await dev.getByRole("alert").getByText("Each model ID must be unique.").waitFor();
 await dev.getByLabel("Model ID priority 2").fill("model-b");await dev.getByRole("button",{name:"Move model 2 up"}).click();assert.equal(await dev.getByLabel("Model ID priority 1").inputValue(),"model-b");await dev.getByRole("button",{name:"Apply",exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem("aiwrevolusi.developerModels.v1"))),["model-b","model-a"]);
 await page.reload();await openDeveloper();assert.equal(await dev.getByLabel("Model ID priority 1").inputValue(),"model-b");await dev.evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));await page.screenshot({path:`${output}/developer-models-desktop.png`});await dev.getByRole("button",{name:"Close",exact:true}).click();
 await seed(page,draft);await page.goto(`${origin}/career/possibilities/resume`);await page.locator(".rw-workbench").waitFor();await pdfReady();
 assert.equal(await page.getByRole("button",{name:"Courses, 3 recommendations"}).count(),1);
 assert.ok(!await page.locator('body').innerText().then(text=>/do-not-display|private-fixture/.test(text)));
 await input().fill("Make the descriptions concise and use moderncv.");await input().press("Control+Enter");const review=page.getByRole("dialog",{name:"Review what AI will receive"});await review.waitFor();assert.equal(requests,0);
 const redacted=await review.getByRole("textbox",{name:"Redacted assistant context"}).inputValue();assert.ok(redacted.includes("PRIVATE_"));assert.ok(!redacted.includes("Alex Doe")&&!redacted.includes("alex@example.test"));
 await review.getByRole("checkbox").check();await review.getByRole("button",{name:"Confirm and send"}).click();await page.getByText("Suggested changes",{exact:true}).waitFor();assert.equal(requests,1);assert.equal(assistInputs[0].models,'["model-b","model-a"]');
 const skill=page.getByLabel("Bullet · Skills entry 1 bullet",{exact:true});assert.equal(await skill.inputValue(),"SQL");
 await page.locator(".rw-assistant-change").filter({hasText:"theme"}).getByRole("checkbox").uncheck();await page.getByRole("button",{name:"Apply selected",exact:true}).click();assert.equal(await skill.inputValue(),"Knowledge of SQL");await pdfReady();assert.equal(renderInputs.at(-1).design.theme,"classic");assert.equal(renderInputs.at(-1).cv.name,"Alex Doe");
 await page.getByRole("button",{name:"Undo",exact:true}).click();assert.equal(await skill.inputValue(),"SQL");await page.getByRole("button",{name:"Redo",exact:true}).click();assert.equal(await skill.inputValue(),"Knowledge of SQL");await pdfReady();
 const dl=page.waitForEvent("download");await page.getByRole("button",{name:"PDF",exact:true}).click();assert.deepEqual(await readFile(await(await dl).path()),lastPdf);
 await input().fill("Improve wording.");await page.getByRole("button",{name:"Send assistant instruction"}).click();await page.getByText("Suggested changes",{exact:true}).waitFor();assert.equal(requests,2);assert.equal(await review.count(),0);
 const other=await context.newPage();await other.goto(origin);await openDeveloper(other);const otherDev=other.getByRole("dialog",{name:"Developer settings"});await otherDev.getByLabel("Model ID priority 1").fill("model-c");await otherDev.getByRole("button",{name:"Apply",exact:true}).click();await page.getByText("This proposal is out of date.",{exact:false}).waitFor();assert.equal(await page.getByRole("button",{name:"Apply selected",exact:true}).isDisabled(),true);await openDeveloper(other);await otherDev.getByLabel("Model ID priority 1").fill("model-b");await otherDev.getByRole("button",{name:"Apply",exact:true}).click();await otherDev.waitFor({state:"hidden"});assert.equal(await page.getByRole("button",{name:"Apply selected",exact:true}).isDisabled(),true);await page.getByRole("button",{name:"Discard",exact:true}).click();
 await input().fill("Improve wording.");await page.getByRole("button",{name:"Send assistant instruction"}).click();await page.getByText("Suggested changes",{exact:true}).waitFor();await skill.fill("SQL temporary edit");await page.getByRole("button",{name:"Undo",exact:true}).click();assert.equal(await skill.inputValue(),"Knowledge of SQL");assert.equal(await page.getByRole("button",{name:"Apply selected",exact:true}).isDisabled(),true);await page.getByRole("button",{name:"Discard",exact:true}).click();
 let release;assistGate=new Promise(resolve=>{release=resolve});await input().fill("Shorten the descriptions.");await page.getByRole("button",{name:"Send assistant instruction"}).click();await page.getByRole("button",{name:"Cancel assistant request"}).waitFor();await openDeveloper(other);await otherDev.getByLabel("Model ID priority 1").fill("model-d");await otherDev.getByRole("button",{name:"Apply",exact:true}).click();await page.getByText("The resume or model settings changed.",{exact:false}).waitFor();release();assistGate=null;await page.getByRole("button",{name:"Send assistant instruction"}).waitFor();assert.equal(await skill.inputValue(),"Knowledge of SQL");
 await page.getByRole("button",{name:"Courses, 3 recommendations"}).click();const courses=page.getByRole("dialog",{name:"Courses for your next role"});await courses.waitFor();assert.equal(await courses.locator(".rw-added-badge").count(),1);
 await courses.getByRole("checkbox",{name:"Select Practical data analysis 1",exact:true}).check();assert.equal(await courses.getByRole("checkbox",{name:"Select all available courses"}).getAttribute("aria-checked"),"mixed");await courses.getByRole("button",{name:"Add selected to My courses",exact:true}).click();await courses.getByText("Added to My courses.",{exact:false}).waitFor();assert.equal(await courses.locator(".rw-added-badge").count(),2);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/courses-mobile-refreshed.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await courses.getByRole("checkbox",{name:"Select all available courses"}).check();await courses.getByRole("button",{name:"Add selected to My courses",exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.rw-added-badge').length===3);await courses.getByRole("button",{name:"Close",exact:true}).click();await courses.waitFor({state:"hidden"});await page.getByRole("button",{name:"Courses, 3 recommendations"}).waitFor();assert.equal(await page.getByRole("button",{name:"Courses, 3 recommendations"}).count(),1);
 await page.getByRole("tab",{name:"Edit",exact:true}).click();await input().fill("Refine the wording.");await skill.fill("SQL for data analysis");await page.getByRole("button",{name:"Send assistant instruction"}).click();await review.waitFor();await review.getByRole("button",{name:"Cancel",exact:true}).click();
 await page.getByRole("button",{name:"YAML",exact:true}).click();const editor=page.locator(".cm-content");const valid=await editor.innerText();await editor.fill("cv: [invalid");assert.equal(await input().isDisabled(),true);await editor.fill(valid);await page.getByRole("button",{name:"YAML",exact:true}).click();await pdfReady();await page.screenshot({path:`${output}/assistant-mobile.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1536,height:1000});await page.waitForFunction(()=>document.querySelector('.rw-pdf canvas[data-render-state="ready"]')?.getBoundingClientRect().width > 500);await page.screenshot({path:`${output}/assistant-desktop.png`});
 await openDeveloper(other);await otherDev.getByRole("button",{name:"Restore defaults",exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem("aiwrevolusi.developerModels.v1")),null);
 await page.reload();await page.locator(".rw-workbench").waitFor();await pdfReady();await input().fill("Shorten.");await page.getByRole("button",{name:"Send assistant instruction"}).click();await review.waitFor();await review.getByRole("button",{name:"Cancel",exact:true}).click();
 await page.getByRole("button",{name:"Account menu",exact:true}).click();await page.getByRole("button",{name:/Log out/}).click();await page.waitForURL(`${origin}/`);assert.equal(await page.locator(".rw-assistant").count(),0);
 signedIn=true;owner="assistant-account-b";workspace={};await page.goto(`${origin}/career/possibilities/resume`);await page.locator(".rb-job-card").waitFor();assert.equal(await page.locator(".rw-assistant").count(),0);
 assert.equal(courseRequests,0);assert.ok(sync.every(body=>!Object.keys(body.data).some(key=>/resume|developerModels/.test(key))));assert.deepEqual(errors,[]);
 console.log("PASS: developer ten-click/timeout/keyboard, priority validation/order/reload/cross-tab/default restore; assistant review/redaction/model header, partial apply/undo/redo/real PDF, no automatic overwrite, stale proposal and request cancellation, manual-change consent, invalid YAML, account cleanup; course badge/dedup/partial/all/added states and mobile layout.");
}catch(error){await page.screenshot({path:`${output}/assistant-failure.png`,fullPage:true});console.error(errors,await page.locator("body").innerText());throw error}finally{await context.close();await browser.close()}
