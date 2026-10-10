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
const errors=[], sync=[], assistInputs=[], renderInputs=[];let owner="assistant-account-a",signedIn=true,assistGate=null,requests=0,lastPdf,courseRequests=0,assistScenario="normal";
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
 if(path==="/reference/wef-skills")return json(route,[{wef_skill_id:1,core_skill:"SQL"},{wef_skill_id:2,core_skill:"Analytical thinking"}]);
 if(path==="/resume/capabilities")return json(route,{ai_configured:true,ai_provider_host:"do-not-display.test",ai_model:"private-fixture",rendercv_version:"2.8"});
 if(path==="/learning/courses")return json(route,{found:true,courses:[1,2,3].map(i=>({course_id:`course-${i}`,skill_id:"analytical-thinking",title:`Practical data analysis ${i}`,provider:"Verified catalogue",level:i===2?"Intermediate":"Beginner",chapters:[{order:1,title:"Practice",duration_min:30}],chapter_count:1}))});
 if(path==="/resume/assist"){
  requests++;const input=req.postDataJSON();assistInputs.push({input,models:req.headers()["x-aiw-models"]});
  const body=JSON.stringify(input);for(const secret of ["Alex Doe","alex@example.test","PRIVATE CONTACT","https://alex.test"])assert.ok(!body.includes(secret));
  assert.equal(input.context_mode,"auto_redacted");assert.ok(!input.context_reviewed&&!input.document.cv.name&&!input.document.cv.email&&!input.mapping);assert.ok(!body.includes("CustomerSecret"));
  const scenario=assistScenario;
  const response={message:"Updated wording and theme.",sections:[{section_index:0,entries:[{entry:{bullet:input.instruction.includes("alternative")?"Understanding SQL":"Knowledge of SQL"},source_ids:["section-0-entry-0"]}]}],design:[{path:["theme"],value:"moderncv"}]};
  if(assistGate)await assistGate;
  if(scenario==="error")return json(route,{detail:"Synthetic assistant failure",code:"ai_budget_exhausted"},503);
  if(scenario==="noop")return json(route,{message:"No edit is needed.",sections:[],design:[]});
  if(scenario==="invalid")response.design=[{path:["templates","normal_entry"],value:"code"}];
  if(scenario==="private")response.sections[0].entries[0].entry={bullet:"[PRIVATE_999]"};
  return json(route,response);
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
const draft={version:1,owner,revision:1,updatedAt:new Date().toISOString(),jobRequirements:"Use SQL to analyse data.",pendingJobRequirements:"Use SQL to analyse data.",document:doc,previewDocument:null,yamlText:JSON.stringify(doc),source:null,previous:null,proposal:null,skillFilterVersion:"role_relevance_v1",skillFilterInputFingerprint:"before-filter",gaps:[{id:"gap",label:"Analysis",keywords:["data"],skill_slugs:["analytical-thinking"]}],recommendations:[1,2,3,1].map(i=>({course_id:`course-${i}`,gap_ids:["gap"],reason:"Practice data analysis with guided exercises relevant to the target role."}))};
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
 const skill=page.getByLabel("Bullet · Skills entry 1 bullet",{exact:true});
 const saved=()=>page.getByText("Saved on this device",{exact:true}).waitFor();
 const read=id=>page.evaluate(id=>new Promise((resolve,reject)=>{const open=indexedDB.open("aiwrevolusi.resume.local.v1",1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction("drafts","readonly"),get=tx.objectStore("drafts").get(id);tx.oncomplete=()=>{resolve(get.result);db.close()};}}),id||owner);
 const applied=()=>page.getByText("Changes applied",{exact:true}).waitFor();
 const send=async text=>{await input().fill(text);await page.getByRole("button",{name:"Send assistant instruction",exact:true}).click();};
 await input().fill("Make the descriptions concise and use moderncv. CustomerSecret");
 assert.equal(await page.locator(".rw-assistant-privacy").getAttribute("open"),null);
 await page.getByText("Privacy options",{exact:true}).click();await page.getByLabel("Additional private terms (one per line)").fill("CustomerSecret");
 let release;assistGate=new Promise(resolve=>{release=resolve;});
 // Repeated shortcuts in the same event turn must still send only once.
 await input().evaluate(element=>{element.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",ctrlKey:true,bubbles:true}));element.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",ctrlKey:true,bubbles:true}));});
 await page.getByText("Updating your resume…",{exact:true}).waitFor();assert.equal(await page.getByRole("dialog",{name:"Review what AI will receive"}).count(),0);
 assert.ok(await page.locator(".rw-assistant-messages").innerText().then(text=>text.includes("CustomerSecret")));
 await page.waitForFunction(()=>document.querySelector('[aria-label="Cancel assistant request"]'));while(requests<1)await page.waitForTimeout(20);assert.equal(requests,1);
 await page.emulateMedia({reducedMotion:"reduce"});assert.equal(await page.locator(".rw-assistant-working svg").evaluate(element=>getComputedStyle(element).animationName),"none");
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/assistant-direct-working-mobile.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const cancelBounds=await page.getByRole("button",{name:"Cancel assistant request",exact:true}).boundingBox();assert.ok(cancelBounds.y>=0&&cancelBounds.y+cancelBounds.height<=844);
 await page.setViewportSize({width:1536,height:1000});await page.emulateMedia({reducedMotion:"no-preference"});await page.screenshot({path:`${output}/assistant-direct-working.png`});release();assistGate=null;await applied();await saved();await pdfReady();
 assert.equal(await skill.inputValue(),"Knowledge of SQL");assert.equal(renderInputs.at(-1).design.theme,"moderncv");assert.equal(renderInputs.at(-1).cv.name,"Alex Doe");assert.equal(assistInputs[0].models,'["model-b","model-a"]');
 assert.equal(await page.getByRole("button",{name:"Apply selected",exact:true}).count(),0);assert.equal(await page.getByText("Suggested changes",{exact:true}).count(),0);
 let record=await read();assert.deepEqual(record.document.cv.sections.Projects,doc.cv.sections.Projects);assert.deepEqual(record.previous.document,doc);assert.equal(record.skillFilterVersion,undefined);assert.equal(record.jobRequirements,draft.jobRequirements);
 assert.ok(await page.getByRole("button",{name:"Undo changes",exact:true}).isVisible());await page.getByRole("button",{name:"Undo changes",exact:true}).click();await saved();assert.equal(await skill.inputValue(),"SQL");assert.equal((await read()).skillFilterInputFingerprint,"before-filter");
 await page.getByRole("button",{name:"Redo",exact:true}).click();await saved();assert.equal(await skill.inputValue(),"Knowledge of SQL");await pdfReady();
 const dl=page.waitForEvent("download");await page.getByRole("button",{name:"PDF",exact:true}).click();const download=await dl;await download.saveAs(`${output}/assistant-direct.pdf`);assert.deepEqual(await readFile(await download.path()),lastPdf);
 // No-op and rejected mixed changes never overwrite either the document or undo snapshot.
 const beforeNoop=await read();assistScenario="noop";await send("Keep the current wording.");await page.getByText("No changes were needed.",{exact:false}).waitFor();assert.deepEqual((await read()).previous,beforeNoop.previous);assert.deepEqual((await read()).document,beforeNoop.document);
 for(const scenario of ["error","invalid","private"]){assistScenario=scenario;await send("Improve wording.");await page.locator(".rw-assistant-error").waitFor();assert.equal(await input().inputValue(),"Improve wording.");assert.deepEqual((await read()).document,beforeNoop.document);assert.deepEqual((await read()).previous,beforeNoop.previous);}
 assistScenario="normal";await send("Use alternative concise wording.");await applied();await saved();assert.equal(await skill.inputValue(),"Understanding SQL");assert.ok(assistInputs.at(-1).input.history.length);assert.ok(!JSON.stringify(assistInputs.at(-1).input.history).includes("CustomerSecret"));
 // Explicit cancellation, manual changes and privacy changes preserve the newest local edits.
 for(const change of ["cancel","manual","privacy"]){assistGate=new Promise(resolve=>{release=resolve;});const count=requests;await send("Shorten the descriptions.");await page.getByText("Updating your resume…",{exact:true}).waitFor();while(requests===count)await page.waitForTimeout(20);
  if(change==="cancel"){await page.getByRole("button",{name:"Cancel assistant request",exact:true}).click();await page.getByText("Request cancelled.",{exact:false}).waitFor();}
  if(change==="manual"){await skill.fill("SQL temporary edit");await page.getByText("The resume or model settings changed.",{exact:false}).waitFor();}
  if(change==="privacy"){await page.getByLabel("Additional private terms (one per line)").fill("CustomerSecret\nAnotherSecret");await page.getByText("The resume or model settings changed.",{exact:false}).waitFor();}
  release();assistGate=null;await page.waitForTimeout(100);assert.equal(await skill.inputValue(),change==="cancel"?"Understanding SQL":"SQL temporary edit");assert.equal(await input().inputValue(),"Shorten the descriptions.");
 }
 // Model changes in another tab also cancel; ignored late responses cannot apply.
 const other=await context.newPage();await other.goto(origin);await openDeveloper(other);const otherDev=other.getByRole("dialog",{name:"Developer settings"});
 assistGate=new Promise(resolve=>{release=resolve;});await send("Shorten the descriptions.");await page.getByText("Updating your resume…",{exact:true}).waitFor();await otherDev.getByLabel("Model ID priority 1").fill("model-c");await otherDev.getByRole("button",{name:"Apply",exact:true}).click();await page.getByText("The resume or model settings changed.",{exact:false}).waitFor();release();assistGate=null;await page.waitForTimeout(100);assert.equal(await skill.inputValue(),"SQL temporary edit");
 await page.getByRole("button",{name:"Courses, 3 recommendations"}).click();const courses=page.getByRole("dialog",{name:"Courses for your next role"});await courses.waitFor();assert.equal(await courses.locator(".rw-added-badge").count(),1);
 await courses.getByRole("checkbox",{name:"Select Practical data analysis 1",exact:true}).check();assert.equal(await courses.getByRole("checkbox",{name:"Select all available courses"}).getAttribute("aria-checked"),"mixed");await courses.getByRole("button",{name:"Add selected to My courses",exact:true}).click();await courses.getByText("Added to My courses.",{exact:false}).waitFor();assert.equal(await courses.locator(".rw-added-badge").count(),2);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/courses-mobile-refreshed.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await courses.getByRole("checkbox",{name:"Select all available courses"}).check();await courses.getByRole("button",{name:"Add selected to My courses",exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.rw-added-badge').length===3);await courses.getByRole("button",{name:"Close",exact:true}).click();await courses.waitFor({state:"hidden"});await page.getByRole("button",{name:"Courses, 3 recommendations"}).waitFor();assert.equal(await page.getByRole("button",{name:"Courses, 3 recommendations"}).count(),1);
 await page.getByRole("tab",{name:"Edit",exact:true}).click();await send("Refine the wording.");await applied();await saved();
 await page.getByRole("button",{name:"YAML",exact:true}).click();const editor=page.locator(".cm-content");const valid=await editor.innerText();await editor.fill("cv: [invalid");assert.equal(await input().isDisabled(),true);await editor.fill(valid);await page.getByRole("button",{name:"YAML",exact:true}).click();await pdfReady();await page.screenshot({path:`${output}/assistant-mobile.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1536,height:1000});await page.waitForFunction(()=>document.querySelector('.rw-pdf canvas[data-render-state="ready"]')?.getBoundingClientRect().width > 500);await page.screenshot({path:`${output}/assistant-desktop.png`});
 await openDeveloper(other);await otherDev.getByRole("button",{name:"Restore defaults",exact:true}).click();assert.equal(await page.evaluate(()=>localStorage.getItem("aiwrevolusi.developerModels.v1")),null);
 await page.reload();await page.locator(".rw-workbench").waitFor();await pdfReady();await input().focus();assert.equal(await page.getByLabel("Additional private terms (one per line)").inputValue(),"");assert.equal(await page.locator(".rw-assistant-messages").innerText(),"");const beforeLogout=await read();assistGate=new Promise(resolve=>{release=resolve;});await send("Use alternative wording.");await page.getByText("Updating your resume…",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Account menu",exact:true}).click();await page.getByRole("button",{name:/Log out/}).click();await page.waitForURL(`${origin}/`);assert.equal(await page.locator(".rw-assistant").count(),0);
 signedIn=true;owner="assistant-account-b";workspace={};await page.goto(`${origin}/career/possibilities/resume`);await page.locator(".rb-job-card").waitFor();release();assistGate=null;await page.waitForTimeout(100);assert.equal(await page.locator(".rw-assistant").count(),0);assert.deepEqual((await read("assistant-account-a")).document,beforeLogout.document);
 assert.equal(courseRequests,0);assert.ok(sync.every(body=>!Object.keys(body.data).some(key=>/resume|developerModels/.test(key))));assert.deepEqual(errors,[]);
 console.log("PASS: developer ten-click/timeout/keyboard, priority validation/order/reload/cross-tab/default restore; assistant direct send/redaction/model header, atomic auto-apply/undo/redo/real PDF, no-op/failure protection, duplicate-send lock and stale request cancellation, manual/privacy changes, invalid YAML, account cleanup; course badge/dedup/partial/all/added states and mobile layout.");
}catch(error){await page.screenshot({path:`${output}/assistant-failure.png`,fullPage:true});console.error(errors,await page.locator("body").innerText());throw error}finally{await context.close();await browser.close()}
