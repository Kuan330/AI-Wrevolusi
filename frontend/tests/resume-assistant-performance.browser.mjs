/** Real local async-assistant route + synthetic upstream; no live AI/account data. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const {chromium}=createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE||"playwright");
const origin=process.env.AIW_QA_ORIGIN||"http://127.0.0.1:5186", backend=process.env.AIW_QA_BACKEND||"http://127.0.0.1:8016";
const output=fileURLToPath(new URL("../../.local/resume-qa/assistant-performance",import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.AIW_QA_BROWSER_CHANNEL||"chrome"});
const context=await browser.newContext({viewport:{width:1536,height:1000},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(15000);
const owner="assistant-performance-synthetic", errors=[];let scenario="ok",calls=0;
let workspace={"aiwrevolusi.courseLibrary.v1":JSON.stringify({version:1,workContext:"",skillId:"",saved:["course-sql"],choices:{},basis:{},pending:[]})};
const doc={cv:{name:"Alex Doe",email:"alex@example.test",sections:{Skills:[{bullet:"Knowledge of SQL"},{bullet:"Excel"}],Projects:[{name:"Data Project",date:"Apr 2026",highlights:["Built reports for 5 teams."]},{name:"Survey Project",date:"Nov 2025",highlights:["Reviewed 180 responses."]}]}},design:{theme:"classic"}};
const draft={version:1,owner,revision:1,updatedAt:new Date().toISOString(),jobRequirements:"Use SQL to analyse data.",pendingJobRequirements:"Use SQL to analyse data.",document:doc,previewDocument:null,yamlText:JSON.stringify(doc),source:null,previous:null,proposal:null,gaps:[],recommendations:[]};
page.on("pageerror",e=>errors.push(e.message));
const json=(route,body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
await context.route("**/*",async route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin!==origin&&!['blob:','data:'].includes(url.protocol))return route.abort();
 if(!url.pathname.startsWith("/api/"))return route.continue();
 const path=url.pathname.replace("/api/v1","");
 if(path==="/account/me")return json(route,{id:owner,email:"synthetic@example.test",full_name:"Synthetic account"});
 if(path==="/account/workspace"){if(req.method()==="PATCH"){workspace=req.postDataJSON().data;return json(route,{owner_id:owner,data:workspace,revision:1})}return json(route,{owner_id:owner,data:workspace,revision:0})}
 if(path==="/reference/wef-skills")return json(route,[{wef_skill_id:1,core_skill:"SQL"}]);
 if(path==="/learning/courses")return json(route,{found:true,courses:[{course_id:"course-sql",skill_id:"sql",title:"SQL fundamentals",provider:"Synthetic catalogue",level:"Beginner",chapter_count:1,chapters:[{order:1,title:"SQL practice",duration_min:30}]}]});
 if(path==="/resume/capabilities")return json(route,{ai_configured:true,ai_provider_host:"synthetic",ai_model:"synthetic",rendercv_version:"2.8"});
 if(path==="/resume/assist"){
  calls++;const body=req.postDataJSON(),data=JSON.stringify(body);assert.ok(!data.includes("Alex Doe")&&!data.includes("alex@example.test"));assert.ok(body.history.length<=4);assert.ok(!body.instruction.includes('Target role (context'));assert.equal(body.target_context,draft.jobRequirements);
  // Continue the actual browser HTTP request: abort must reach ASGI, unlike route.fetch.
  return route.continue({url:`${backend}${url.pathname}`,headers:{...req.headers(),"X-Resume-QA-Scenario":scenario}});
 }
 if(path==="/resume/render")return route.fulfill({response:await route.fetch({url:`${backend}${url.pathname}`})});
 if(path==="/resume/recommend-courses")return json(route,{courses:[]});
 return json(route,{detail:"Offline fixture only"},503);
});
const input=()=>page.getByRole("textbox",{name:"Ask AI to edit your resume"});
const first=()=>page.getByLabel("Bullet · Skills entry 1 bullet",{exact:true});
const saved=()=>page.getByText("Saved on this device",{exact:true}).waitFor();
const send=async text=>{await input().fill(text);await page.getByRole("button",{name:"Send assistant instruction",exact:true}).click()};
const read=()=>page.evaluate(owner=>new Promise((resolve,reject)=>{const r=indexedDB.open("aiwrevolusi.resume.local.v1",1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction("drafts","readonly"),q=tx.objectStore("drafts").get(owner);tx.oncomplete=()=>{db.close();resolve(q.result)}}}),owner);
const counts=async()=> (await context.request.get(`${backend}/qa/assist-counts`)).json();
const pdfReady=()=>page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF'&&!b.disabled));
try{
 await page.goto(origin);await page.getByRole("button",{name:"© 2026 AI-Wrevolusi",exact:true}).waitFor();
 await page.evaluate(draft=>new Promise((resolve,reject)=>{const r=indexedDB.open("aiwrevolusi.resume.local.v1",1);r.onupgradeneeded=()=>r.result.createObjectStore("drafts");r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").put(draft,draft.owner);tx.oncomplete=()=>{db.close();resolve()}}}),draft);
 await page.goto(`${origin}/career/possibilities/resume`);await page.locator(".rw-workbench").waitFor();await pdfReady();
 const before=await read();const baseline=(await counts()).ok?.calls||0;
 await input().fill("Shorten the skill wording.");await input().press("Control+Enter");
 await page.getByText("Changes applied",{exact:true}).waitFor();await saved();await pdfReady();
 assert.equal(await first().inputValue(),"SQL");assert.equal(calls,1);assert.equal((await counts()).ok.calls-baseline,1);
 assert.equal(await page.getByRole("dialog",{name:"Review what AI will receive"}).count(),0);assert.equal(await page.getByText("Suggested changes",{exact:true}).count(),0);
 let current=await read();assert.deepEqual(current.document.cv.sections.Projects,doc.cv.sections.Projects);assert.deepEqual(current.document.cv.sections.Skills[1],doc.cv.sections.Skills[1]);assert.deepEqual(current.previous.document,before.document);
 await page.getByRole("button",{name:"Undo changes",exact:true}).click();await saved();assert.equal(await first().inputValue(),"Knowledge of SQL");
 await page.getByRole("button",{name:"Redo",exact:true}).click();await saved();assert.equal(await first().inputValue(),"SQL");
 scenario="assist_repair";const initial=(await counts()).assist_repair?.calls||0;await send("Refine the wording.");await page.getByText("Changes applied",{exact:true}).waitFor();await saved();
 assert.equal(await first().inputValue(),"Knowledge of SQL");assert.equal((await counts()).assist_repair.calls-initial,2);
 for(const [value,message,expected] of [["assist_timeout","AI editing timed out.",1],["assist_transport","Could not connect",1],["assist_credentials","AI credentials were rejected",1],["assist_invalid","AI editing returned invalid output",2],["assist_bad_reference","AI editing could not produce valid changes",2]]){
  scenario=value;const beforeError=await read(),initial=(await counts())[value]?.calls||0;await send("Refine safely.");
  await page.locator(".rw-assistant-error").filter({hasText:message}).waitFor();assert.equal(await input().inputValue(),"Refine safely.");
  const after=await read();assert.deepEqual(after.document,beforeError.document);assert.deepEqual(after.previous,beforeError.previous);assert.equal((await counts())[value].calls-initial,expected);
  if(value==='assist_bad_reference')assert.ok(!/Source Ids|more specific instruction/.test(await page.locator('.rw-assistant-error').innerText()));
 }
 scenario="assist_cancel";const initialCancel=(await counts()).assist_cancel?.cancelled||0;
 await send("Improve the wording without adding facts.");await page.getByText("Updating your resume…",{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/async-working-mobile.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const beforeCancel=await read();await page.getByRole("button",{name:"Cancel assistant request",exact:true}).click();await page.getByText("Request cancelled.",{exact:false}).waitFor();
 for(let i=0;i<40&&(await counts()).assist_cancel.cancelled===initialCancel;i++)await page.waitForTimeout(50);
 assert.equal((await counts()).assist_cancel.cancelled-initialCancel,1);assert.deepEqual((await read()).document,beforeCancel.document);
 scenario="ok";await send("Refine safely after cancelling.");await page.getByText("Changes applied",{exact:true}).waitFor();await saved();await pdfReady();
 const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"PDF",exact:true}).click();await (await downloadPromise).saveAs(`${output}/async-assistant.pdf`);
 await page.setViewportSize({width:1536,height:1000});await page.waitForFunction(()=>document.querySelector('.rw-pdf canvas[data-render-state="ready"]')?.getBoundingClientRect().width>500);await page.screenshot({path:`${output}/async-applied-desktop.png`});await page.reload();await first().waitFor();assert.equal(await first().inputValue(),"SQL");
 // Legacy draft with no Skills: add only a request candidate and undo once.
 await page.evaluate(owner=>new Promise((resolve,reject)=>{const r=indexedDB.open("aiwrevolusi.resume.local.v1",1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction("drafts","readwrite"),store=tx.objectStore("drafts"),get=store.get(owner);get.onsuccess=()=>{const value=get.result;delete value.document.cv.sections.Skills;value.yamlText=JSON.stringify(value.document);value.previous=null;value.proposal=null;store.put(value,owner);};tx.oncomplete=()=>{db.close();resolve();};};}),owner);
 await page.reload();await page.locator(".rw-workbench").waitFor();await pdfReady();const withoutSkills=await read();assert.equal(withoutSkills.document.cv.sections.Skills,undefined);
 await send("Add my selected SQL skill.");await page.getByText("Changes applied",{exact:true}).waitFor();await saved();await pdfReady();assert.deepEqual((await read()).document.cv.sections.Skills,[{bullet:"SQL"}]);assert.deepEqual((await read()).document.cv.sections.Projects,withoutSkills.document.cv.sections.Projects);
 await page.getByRole("button",{name:"Undo changes",exact:true}).click();await saved();assert.deepEqual((await read()).document,withoutSkills.document);
 // Direct shortcuts preserve unsent input; Enter/IME and pending composition never double-send.
 await input().fill("Keep this unsent instruction");const beforeShortcut=calls;
 await page.getByRole("button",{name:"Highlight skills",exact:true}).click();await page.getByText("Changes applied",{exact:true}).waitFor();await saved();
 assert.equal(calls,beforeShortcut+1);assert.equal(await input().inputValue(),"Keep this unsent instruction");
 scenario="assist_implicit";const beforePolish=calls;await page.getByRole('button',{name:'Polish wording',exact:true}).click();await page.getByText('Changes applied',{exact:true}).waitFor();await saved();assert.equal(calls,beforePolish+1);assert.equal(await input().inputValue(),'Keep this unsent instruction');assert.equal(await page.locator('.rw-assistant-error').count(),0);
 assert.ok((await page.locator('.rw-assistant-messages').innerText()).includes('Updated Skills (1 entry).'));
 scenario="assist_partial_highlight";const beforePartial=await read(),partialCalls=calls;
 await send("Polish project descriptions");await page.getByText('Changes applied',{exact:true}).waitFor();await saved();await pdfReady();
 const partial=await read(),expectedProjects=structuredClone(beforePartial.document.cv.sections.Projects);
 expectedProjects[0].highlights[0]='Built reports: 5 teams.';
 assert.equal(calls,partialCalls+1);assert.deepEqual(partial.document.cv.sections.Projects,expectedProjects);assert.deepEqual(partial.document.cv.sections.Skills,beforePartial.document.cv.sections.Skills);
 await page.getByRole('button',{name:'Undo changes',exact:true}).click();await saved();assert.deepEqual((await read()).document,beforePartial.document);
 const beforeShorten=calls;await input().fill('Keep this next instruction');
 await page.getByRole('button',{name:'Shorten descriptions',exact:true}).click();await page.getByText('Changes applied',{exact:true}).waitFor();await saved();
 assert.equal(calls,beforeShorten+1);assert.equal(await input().inputValue(),'Keep this next instruction');assert.deepEqual((await read()).document.cv.sections.Projects,expectedProjects);
 await page.getByRole('button',{name:'Undo changes',exact:true}).click();await saved();assert.deepEqual((await read()).document,beforePartial.document);
 const beforeKeyboard=calls;await input().fill("First line");await input().press("Shift+Enter");assert.equal(await input().inputValue(),"First line\n");
 await input().evaluate(element=>element.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",isComposing:true,bubbles:true})));assert.equal(calls,beforeKeyboard);
 scenario="assist_slow";await input().fill("Shorten Skills");await input().press("Enter");await page.getByText("Updating your resume…",{exact:true}).waitFor();
 assert.equal(await input().isEnabled(),true);await input().fill("Polish the next edit");await input().press("Enter");
 await page.getByText("Changes applied",{exact:true}).waitFor();await saved();assert.equal(calls,beforeKeyboard+1);assert.equal(await input().inputValue(),"Polish the next edit");
 scenario="assist_question";const beforeQuestion=(await counts()).assist_question?.calls||0;await input().press("Control+Enter");await page.getByText("Changes applied",{exact:true}).waitFor();await saved();assert.equal((await counts()).assist_question.calls-beforeQuestion,2);
 assert.ok(!(await page.locator('.rw-assistant-messages').innerText()).includes('Would you like'));
 const beforeEmpty=await read();scenario="assist_empty";await send("Refine wording");await page.locator('.rw-assistant-error').waitFor();assert.equal(await input().inputValue(),"Refine wording");assert.deepEqual((await read()).document,beforeEmpty.document);
 scenario="ok";await input().fill("Preserve this next instruction");await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByText("Changes applied",{exact:true}).waitFor();await saved();assert.equal(await input().inputValue(),"Preserve this next instruction");
 for(const [value,label] of [["assist_no_change","Already up to date"],["assist_unsupported","No changes applied"]]){
  scenario=value;const snapshot=await read();await send("Make this professional");await page.getByText(label,{exact:true}).waitFor();assert.deepEqual((await read()).document,snapshot.document);assert.deepEqual((await read()).previous,snapshot.previous);
 }
 assert.ok((await page.locator('.rw-assistant-messages').innerText()).includes('does not contain the facts'));
 scenario="ok";const beforeStyle=await read();await page.getByRole('button',{name:'Apply modern style',exact:true}).click();await page.getByText('Changes applied',{exact:true}).waitFor();await saved();await pdfReady();
 assert.equal((await read()).document.design.theme,'moderncv');assert.deepEqual((await read()).document.cv,beforeStyle.document.cv);
 await page.waitForFunction(()=>document.querySelector('.rw-pdf canvas[data-render-state="ready"]')?.getBoundingClientRect().width>500);await page.screenshot({path:`${output}/direct-edit-desktop.png`});await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'Edit',exact:true}).click();await page.screenshot({path:`${output}/direct-edit-mobile.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const assistantBounds=await page.locator('.rw-assistant').boundingBox();assert.ok(assistantBounds.y+assistantBounds.height<=845);
 assert.deepEqual(errors,[]);console.log("PASS: real backend compact updates, untouched rows/projects, keyboard direct apply, undo/redo, shared-budget single correction, timeout/connection/credentials/output errors, actual browser-to-ASGI cancellation, resend, mobile/desktop, PDF and persistence.");
}catch(error){await page.screenshot({path:`${output}/async-failure.png`,fullPage:true});console.error(await page.locator('body').innerText());throw error}finally{await context.close();await browser.close()}
