/** Controlled, synthetic before/after measurement; no AI calls. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
import {mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {blankPdf} from './resume-fixtures.mjs';
import {performanceDocument,performanceAlignment} from './resume-performance-fixtures.mjs';
import {documentYaml} from '../src/features/resume/document.ts';
const {chromium}=createRequire(import.meta.url)(process.env.AIW_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.AIW_QA_ORIGIN||'http://127.0.0.1:5186',label=process.env.AIW_PERF_LABEL||'baseline',out=fileURLToPath(new URL('../../.local/resume-qa/performance/',import.meta.url));assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[],errors=[];
const role={occupation_code:'2421',title:'Management and Organisation Analysts',skills:[{skill_id:1,skill_slug:'analytical-thinking',name:'Analytical thinking'}],tasks:['Analyse synthetic records.']};
const job=[role.title,'Required skills:','- Analytical thinking'].join('\n');
const percentile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
let live;
try{for(let round=0;round<3;round++){
 const owner='resume-perf-'+round,context=await browser.newContext({viewport:{width:1440,height:1000}});live=context;const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 let workspace={'aiwrevolusi.possibilities.chosenDirection':JSON.stringify({occupation_code:'2421'}),'aiwrevolusi.learningSkills.v1':JSON.stringify([{id:'analytical-thinking',name:'Analytical thinking',source:'wef'}]),'aiwrevolusi.courseLibrary.v1':JSON.stringify({version:1,workContext:'',skillId:'',saved:['course'],choices:{},basis:{},pending:[]})},renders=0;const calls=[],assets=[];
 page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('.js'))assets.push(r.url())});const json=(route,body)=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==origin&&!['blob:','data:'].includes(url.protocol))return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();const path=url.pathname.replace('/api/v1','');
  if(path==='/account/me')return json(route,{id:owner,email:'synthetic@example.test',full_name:'Synthetic account'});
  if(path==='/account/workspace'){if(req.method()==='PATCH')workspace=req.postDataJSON().data;return json(route,{owner_id:owner,data:workspace,revision:0})}
  if(['/reference/wef-skills','/learning/courses','/learning/progress'].includes(path)){const row={path,began:performance.now(),ended:0};calls.push(row);await new Promise(resolve=>setTimeout(resolve,400));row.ended=performance.now();if(path==='/reference/wef-skills')return json(route,[{wef_skill_id:1,core_skill:'Analytical thinking'}]);if(path==='/learning/courses')return json(route,{found:true,courses:[{course_id:'course',skill_id:'analytical-thinking',title:'Synthetic course',chapter_count:1,chapters:[{order:1,title:'A'}]}]});return json(route,{chapters:[]})}
  if(path==='/possibilities/2421/requirements')return json(route,role);if(path==='/resume/capabilities')return json(route,{ai_configured:true,rendercv_version:'2.8'});
  if(path==='/resume/render'){renders++;return route.fulfill({contentType:'application/pdf',body:blankPdf()})}if(path==='/resume/recommend-courses')return json(route,{courses:[]});return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Synthetic-only endpoint'})});
 });
 const begin=performance.now();await page.goto(origin+'/career/possibilities/resume');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Generate my resume'&&!b.disabled));
 results.push({round,ready_ms:performance.now()-begin,initialAssets:[...new Set(assets)],dependency_start_spread_ms:Math.max(...calls.map(c=>c.began))-Math.min(...calls.map(c=>c.began)),calls});
 await page.getByText('Saved on this device',{exact:true}).waitFor();await page.waitForFunction(()=>!document.body.textContent.includes('Loading synchronised learning records'));
 if(round===2){
  const document=performanceDocument(),draft={version:1,owner,revision:1,updatedAt:'2026-10-12T00:00:00Z',jobRequirements:job,pendingJobRequirements:job,targetRole:role,document,yamlText:documentYaml(document),source:null,previous:null,proposal:null,gaps:[],recommendations:[],careerAlignment:performanceAlignment(document)};
  await page.evaluate(async({owner,draft})=>{await new Promise((resolve,reject)=>{const req=indexedDB.open('aiwrevolusi.resume.local.v1',1);req.onsuccess=()=>{const db=req.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft,owner);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})},{owner,draft});
  await page.reload();await page.locator('.rw-workbench').waitFor();const readyPDF=()=>page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='PDF'&&!b.disabled));await readyPDF();
  const input=page.getByRole('textbox',{name:'Name · Personal name',exact:true});await input.focus();
  await input.evaluate(element=>{window.__aiwResumePerfSamples=[];element.addEventListener('input',()=>{const began=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>window.__aiwResumePerfSamples.push(performance.now()-began)))})});
  if(process.env.AIW_PERF_PROFILE==='1'){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  let count=0;for(const key of 'abcdefghijklmnop'){await page.keyboard.press(key);await page.waitForFunction(count=>window.__aiwResumePerfSamples.length>count,count++);}
  const samples=await page.evaluate(()=>window.__aiwResumePerfSamples);
  if(process.env.AIW_PERF_PROFILE==='1'){const {profile}=await cdp.send('Profiler.stop');await writeFile(out+label+'-typing-profile.json',JSON.stringify(profile));}
  const typed=await input.inputValue();assert.equal(typed,'Performance Sampleabcdefghijklmnop');await page.getByText('Saved on this device',{exact:true}).waitFor();await readyPDF();
  const beforeUndo=renders,undo=performance.now();await page.getByRole('button',{name:'Undo',exact:true}).click();await readyPDF();assert.ok(typed.startsWith(await input.inputValue()));
  results[round].edit={skills:250,median_ms:percentile(samples,.5),p95_ms:percentile(samples,.95),samples_ms:samples,undo_preview_ms:performance.now()-undo,undo_render_requests:renders-beforeUndo};
  // Stable memoised handlers must use the latest sibling fields/rows, not captured old documents.
  const keptName=await input.inputValue(), skills=page.locator('.rw-section[data-title="Skills"] textarea');
  await skills.nth(0).fill('Reviewed first skill');
  const project=page.getByRole('textbox',{name:'Name · Projects entry 1 name',exact:true});await project.fill('Revised synthetic project');
  await skills.nth(1).fill('Reviewed second skill');
  assert.equal(await input.inputValue(),keptName);assert.equal(await skills.nth(0).inputValue(),'Reviewed first skill');assert.equal(await project.inputValue(),'Revised synthetic project');
  await page.getByRole('button',{name:'Move Skills entry 1 down',exact:true}).click();
  assert.equal(await skills.nth(0).inputValue(),'Reviewed second skill');assert.equal(await skills.nth(1).inputValue(),'Reviewed first skill');
  await page.getByRole('button',{name:'Remove Skills entry 1',exact:true}).click();assert.equal(await skills.count(),249);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await skills.count(),250);assert.equal(await skills.nth(0).inputValue(),'Reviewed second skill');
  await page.getByRole('button',{name:'YAML',exact:true}).click();const yaml=page.getByRole('textbox',{name:'RenderCV YAML document',exact:true});await yaml.waitFor();
  assert.ok((await yaml.innerText()).includes('Reviewed second skill'));
  // CodeMirror virtualises off-screen lines; verify the complete document through its public export.
  await page.getByRole('button',{name:'Resume options',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download YAML',exact:true}).click();const raw=await (await import('node:fs/promises')).readFile(await (await downloading).path(),'utf8');assert.ok(raw.includes(keptName)&&raw.includes('Revised synthetic project')&&raw.includes('Reviewed first skill'));await page.getByRole('dialog',{name:'Resume options',exact:true}).getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'YAML',exact:true}).click();
  await page.getByText('Saved on this device',{exact:true}).waitFor();await page.reload();await page.locator('.rw-workbench').waitFor();assert.equal(await input.inputValue(),keptName);assert.equal(await project.inputValue(),'Revised synthetic project');assert.equal(await skills.nth(0).inputValue(),'Reviewed second skill');await page.screenshot({path:out+label+'-editor.png',animations:'disabled'});
 }
 await context.unrouteAll({behavior:'wait'});await context.close();live=null;
}
 assert.deepEqual(errors,[]);const assets={},directory=process.env.AIW_PERF_DIST_DIR?pathToFileURL(process.env.AIW_PERF_DIST_DIR+'/assets/'):new URL('../dist/assets/',import.meta.url);for(const name of (await readdir(directory)).filter(n=>/^(ResumeBuilder|YamlEditor)-.*\.js$/.test(n)))assets[name]=(await stat(new URL(name,directory))).size;
 const report={functional_checks:['latest sibling fields','latest entry values','reorder','delete undo','lazy YAML current values','refresh persistence'],label,synthetic_only:true,real_ai_used:false,cpu_throttle:4,independent_api_delay_ms:400,input_measurement:'native input event to two animation frames; locator time excluded',median_ready_ms:percentile(results.map(r=>r.ready_ms),.5),assets,results};await writeFile(out+label+'-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({label,median_ready_ms:report.median_ready_ms,edit:results[2].edit,assets}));
}finally{if(live)await live.unrouteAll({behavior:'wait'});await browser.close()}
