/** Synthetic-only acceptance of role-filtered Skills through the real local generator. */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {docxFixture} from "./resume-fixtures.mjs";
const {chromium}=createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE||"playwright");
const origin=process.env.AIW_QA_ORIGIN||"http://127.0.0.1:5186", backend="http://127.0.0.1:8016";
assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
const out=fileURLToPath(new URL("../../.local/resume-qa/role-relevance",import.meta.url));await mkdir(out,{recursive:true});
const management={occupation_code:"2421",title:"Management and Organization Analysts",skills:[{skill_id:1,skill_slug:"analytical-thinking",name:"Analytical thinking"},{skill_id:2,skill_slug:"leadership",name:"Leadership"}]};
const software={occupation_code:"2512",title:"Software developers",skills:[{skill_id:3,skill_slug:"programming",name:"Programming"},{skill_id:6,skill_slug:"sql",name:"SQL"}]};
const service={occupation_code:"2422",title:"Synthetic service role",skills:[{skill_id:7,skill_slug:"service-orientation",name:"Service orientation"}]};
const roles=new Map([management,software,service].map(r=>[r.occupation_code,r]));
const profile={jobTitle:"Synthetic analyst",tasks:[{id:"t1",wording:"Analyse synthetic reports"}],tasksConfirmed:true,tasksOccupationCode:"2421",profileVersion:1};
const at="2026-10-10T00:00:00Z",key="aiwrevolusi.possibilities.chosenDirection";
const base={
  [key]:JSON.stringify({occupation_code:"2421"}),
  "aiwrevolusi.userProfile":JSON.stringify(profile),
  "aiwrevolusi.journey.v1":JSON.stringify({version:1,contexts:{},courseContexts:{},review:{workKey:JSON.stringify({occupationCode:"2421",tasks:profile.tasks}),decisions:{"1":"accepted","2":"rejected","5":"accepted"},completed:true,updatedAt:at}}),
  "aiwrevolusi.learningSkills.v1":JSON.stringify([{id:"programming",name:"Programming",source:"wef"}]),
  "aiwrevolusi.courseLibrary.v1":JSON.stringify({version:1,workContext:"",skillId:"",saved:["reading"],choices:{},basis:{},pending:[]}),
};
let owner="relevance-a",workspace={...base},revision=0,scenario="role_relevance",generationGate=null,referenceChanged=false;
const browser=await chromium.launch({headless:true,channel:process.env.AIW_QA_BROWSER_CHANNEL||"chrome"});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(25000);
const errors=[],requests=[],renders=[];page.on("pageerror",error=>errors.push(error.message));
const json=(route,body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
await context.route("**/*",async route=>{
 const request=route.request(),url=new URL(request.url());if(url.origin!==origin&&!['blob:','data:'].includes(url.protocol))return route.abort();
 if(!url.pathname.startsWith('/api/'))return route.continue();const path=url.pathname.replace('/api/v1','');
 if(path==='/account/me')return json(route,{id:owner,email:'synthetic@example.test',full_name:'Synthetic user'});
 if(path==='/account/workspace'){if(request.method()==='PATCH'){const body=request.postDataJSON();workspace=body.data;revision=body.revision+1;}return json(route,{owner_id:owner,data:workspace,revision});}
 if(path==='/reference/wef-skills')return json(route,[{wef_skill_id:1,core_skill:'Analytical thinking'},{wef_skill_id:2,core_skill:'Leadership'},{wef_skill_id:3,core_skill:'Programming'},{wef_skill_id:4,core_skill:'Reading, writing and mathematics'},{wef_skill_id:5,core_skill:'AI and big data'},{wef_skill_id:6,core_skill:'SQL'}]);
 if(path==='/learning/courses')return json(route,{found:true,courses:[{course_id:'reading',skill_id:'reading-writing-and-mathematics',title:'Synthetic reading course'}]});
 if(path==='/resume/capabilities')return json(route,{ai_configured:true,rendercv_version:'2.8'});
 const match=path.match(/^\/possibilities\/([^/]+)\/requirements$/);if(match)return json(route,roles.get(match[1]));
 if(path==='/resume/recommend-courses')return json(route,{courses:[]});
 if(path==='/resume/generate'){
  const input=request.postDataJSON(),runScenario=scenario;requests.push(input);
  const target=structuredClone(roles.get(input.occupation_code));
  if(referenceChanged)target.title+=' (updated reference)';
  if(generationGate)await generationGate;
  const response=await route.fetch({url:backend+url.pathname,headers:{...request.headers(),'X-Resume-QA-Scenario':runScenario,'X-Resume-QA-Role':JSON.stringify(target)}});
  return route.fulfill({response});
 }
 if(path==='/resume/render'){renders.push(request.postDataJSON().document);const response=await route.fetch({url:backend+url.pathname});return route.fulfill({response});}
 return json(route,{detail:'Synthetic endpoint unavailable'},503);
});
const saved=()=>page.getByText('Saved on this device',{exact:true}).waitFor();
const read=(id=owner)=>page.evaluate(id=>new Promise((resolve,reject)=>{const open=indexedDB.open('aiwrevolusi.resume.local.v1',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readonly'),get=tx.objectStore('drafts').get(id);tx.oncomplete=()=>{const record=get.result;resolve(record?.source?{...record,source:{...record.source,file:{size:record.source.file.size,type:record.source.file.type}}}:record);db.close();};};}),id);
const target=async()=>{await page.getByRole('button',{name:'Target role',exact:true}).click();await page.getByRole('heading',{name:'Bring your existing resume',exact:true}).waitFor();};
const start=async()=>{await page.getByRole('button',{name:'Generate new suggestions',exact:true}).click();const confirm=page.getByRole('dialog',{name:'Tailor for another role?'});if(await confirm.count())await confirm.getByRole('button',{name:'Generate suggestions',exact:true}).click();};
const proposal=page.getByRole('dialog',{name:'Review AI suggestions'});
const chooseChapter=async title=>{for(const row of await proposal.locator('.rb-proposal').all())if(await row.locator('strong').first().textContent()===title)await row.getByRole('checkbox').check();};
const apply=async()=>{await proposal.getByRole('button',{name:'Apply selected chapters',exact:true}).click();await saved();};
const changeRole=async role=>{workspace[key]=JSON.stringify({occupation_code:role.occupation_code});await page.reload();await page.locator('.rw-workbench').waitFor();await saved();};
try{
 await page.goto(origin+'/career/possibilities/resume');
 const sample=['Alex Example','Core Skills','Excel, SQL, Life insurance','Professional Experience','Synthetic analyst | Apr 2026','• Reviewed 180 records.','Projects','Retail Sales Analysis | Apr 2026','• Cleaned 2,400 records.','• Removed 36 duplicates.'].join('\n');
 const source=docxFixture(sample.split("\n"));
 await page.getByLabel('Upload original resume PDF or DOCX').setInputFiles({name:'synthetic-role.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:source});
 await page.getByText('I have reviewed this text and removed',{exact:false}).click();
 await page.getByRole('button',{name:'Generate my resume',exact:true}).click();await page.locator('.rw-workbench').waitFor();await saved();
 const first=await read(),names=first.document.cv.sections.Skills.map(e=>e.bullet),candidates=requests[0].skills.map(s=>s.name);
 assert.equal(requests[0].occupation_code,'2421');
 for(const skill of ['Excel','SQL','Life insurance','Analytical thinking','Programming','AI and big data','Reading, writing and mathematics'])assert.ok(candidates.includes(skill),skill);
 assert.ok(!candidates.includes('Leadership')&&!candidates.includes('Synthetic reading course'));
 assert.deepEqual(new Set(names),new Set(candidates.filter(name=>name!=='Life insurance')));
 assert.equal(first.skillFilterVersion,'role_relevance_v1');assert.equal(first.skillFilterInputFingerprint,first.generationInputFingerprint);
 assert.ok(first.source.redactedText.includes('Life insurance'));assert.equal(first.source.file.size,source.length);
 assert.deepEqual(first.document.cv.sections.Projects[0],{name:'Retail Sales Analysis',date:'Apr 2026',highlights:['Cleaned 2,400 records.','Removed 36 duplicates.']});
 for(const storageKey of Object.keys(base).filter(k=>k!==key))assert.equal(workspace[storageKey],base[storageKey]);
 const filteredDownloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'PDF',exact:true}).click();const filteredDownload=await filteredDownloadPromise;await filteredDownload.saveAs(out+'/filtered-skills.pdf');
 await page.screenshot({path:out+'/filtered-skills.png',fullPage:true});
 // Reference mismatch must not call AI or mutate the existing document; retry remains explicit.
 await target();referenceChanged=true;await start();await page.getByText('The target role requirements changed.',{exact:false}).first().waitFor();
 assert.deepEqual((await read()).document,first.document);assert.equal((await read()).proposal,null);
 referenceChanged=false;await page.getByRole('button',{name:'Retry role requirements',exact:true}).click();await page.getByRole('heading',{name:management.title,exact:true}).waitFor();
 // Only standard matches survive failure for a newly selected role; applied interview target remains old.
 await page.getByRole('button',{name:'Back to editing',exact:true}).click();await changeRole(software);await target();scenario='unavailable';await start();await proposal.waitFor();
 let current=await read();assert.equal(current.proposal.outcome,'source_preserved');
 assert.deepEqual(current.proposal.sections.find(s=>s.title==='Skills').entries.map(e=>e.text),['Programming','SQL']);
 await proposal.getByText('Skill relevance checking was incomplete.',{exact:false}).waitFor();
 await chooseChapter('Skills');await apply();current=await read();assert.deepEqual(current.document.cv.sections.Skills.map(e=>e.bullet),['Programming','SQL']);assert.equal(current.jobRequirements,first.jobRequirements);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved();assert.deepEqual((await read()).document,first.document);assert.equal((await read()).targetRole.occupation_code,'2512');
 // Applying another chapter cannot falsely mark old Skills as filtered for the new inputs.
 await target();scenario='role_relevance';await start();await proposal.waitFor();await chooseChapter('Experience');await apply();
 current=await read();assert.equal(current.skillFilterInputFingerprint,first.skillFilterInputFingerprint);assert.deepEqual(current.document.cv.sections.Skills,first.document.cv.sections.Skills);
 await page.getByText('Skills have not been filtered for the current target and inputs.',{exact:false}).waitFor();
 // Explicit zero-match Skills application removes old Skills, not source evidence/projects/learning.
 const beforeEmpty=await read();await changeRole(service);await target();scenario='all_unrelated';await start();await proposal.waitFor();
 current=await read();assert.deepEqual(current.proposal.sections.find(s=>s.title==='Skills').entries,[]);
 await proposal.getByText('Apply this chapter to remove the current Skills list.',{exact:false}).waitFor();
 await chooseChapter('Skills');await apply();current=await read();assert.equal(current.document.cv.sections.Skills,undefined);
 assert.deepEqual(current.document.cv.sections.Projects,beforeEmpty.document.cv.sections.Projects);assert.deepEqual(current.document.cv.sections.Experience,beforeEmpty.document.cv.sections.Experience);assert.equal(current.source.file.size,source.length);
 for(const storageKey of Object.keys(base).filter(k=>k!==key))assert.equal(workspace[storageKey],base[storageKey]);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'PDF',exact:true}).click();const download=await downloadPromise;await download.saveAs(out+'/no-skills.pdf');assert.equal((await readFile(await download.path())).subarray(0,5).toString(),'%PDF-');assert.equal(renders.at(-1).cv.sections.Skills,undefined);
 await page.screenshot({path:out+'/no-related-skills.png',fullPage:true});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await saved();assert.deepEqual((await read()).document,beforeEmpty.document);assert.equal((await read()).targetRole.occupation_code,'2422');
 // Cancel and retry preserve the document and clear un-applied proposals.
 await target();scenario='progress';await start();await page.getByRole('progressbar',{name:'Tailoring your resume',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel generation',exact:true}).click();await page.getByText('Generation cancelled.',{exact:false}).waitFor();assert.equal((await read()).proposal,null);
 scenario='all_unrelated';await start();await proposal.waitFor();await proposal.getByRole('button',{name:'Keep current resume',exact:true}).click();
 // An old unfiltered proposal is invalidated on reload without rewriting the old document.
 await page.evaluate(async owner=>{await new Promise((resolve,reject)=>{const open=indexedDB.open('aiwrevolusi.resume.local.v1',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),get=store.get(owner);get.onsuccess=()=>{const record=get.result;delete record.skillFilterVersion;delete record.skillFilterInputFingerprint;record.proposal={sections:[{title:'Skills',entries:[{text:'Life insurance',skill_ids:['old'],fact_ids:[]}]}],gaps:[],jobRequirements:record.pendingJobRequirements,inputFingerprint:'old-unfiltered'};store.put(record,owner);};tx.oncomplete=()=>{db.close();resolve();};};});},owner);
 await page.reload();await page.locator('.rw-workbench').waitFor();await saved();assert.equal((await read()).proposal,null);assert.deepEqual((await read()).document,beforeEmpty.document);
 // Ignore an old account's delayed result when another account signs in.
 await target();let release;generationGate=new Promise(resolve=>{release=resolve;});const count=requests.length;await start();await page.waitForFunction(()=>document.querySelector('[role="progressbar"]'));
 while(requests.length===count)await new Promise(resolve=>setTimeout(resolve,20));
 owner='relevance-b';workspace={[key]:JSON.stringify({occupation_code:'2421'})};revision=0;await page.reload();await page.getByRole('heading',{name:'Bring your existing resume',exact:true}).waitFor();release();generationGate=null;await page.waitForTimeout(500);
 assert.equal((await read()).document,null);assert.equal((await read()).proposal,null);assert.deepEqual((await read('relevance-a')).document,beforeEmpty.document);
 assert.equal(await page.getByRole('button',{name:'Generate my resume',exact:true}).isDisabled(),true);await page.getByText('Add reviewed resume details or selected user skills before generating.',{exact:false}).waitFor();
 // Skills-only input without any related candidate is an explicit error, not an empty generated document.
 await page.getByRole('button',{name:'Or enter your resume details manually',exact:true}).click();await page.getByLabel('Resume evidence that AI will receive').fill('Skills\nLife insurance');await page.getByText('I have reviewed this text and removed',{exact:false}).click();scenario='all_unrelated';await page.getByRole('button',{name:'Generate my resume',exact:true}).click();await page.getByText('No verified role-related skills or reviewed experience are available.',{exact:false}).waitFor();assert.equal((await read()).document,null);
 assert.deepEqual(errors,[]);console.log('PASS: three candidate sources, role/code binding, direct+semantic subset, unchanged source/profile, reference retry, conservative fallback, selective apply/undo, zero-match removal/PDF, cancel/retry, legacy proposal invalidation and account isolation');
}catch(error){console.error('DIAGNOSTIC',JSON.stringify({requests:requests.length,errors,notices:await page.locator('.rb-error,.rb-warning').allTextContents()}));await page.screenshot({path:out+'/failure.png',fullPage:true});throw error;}finally{await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
