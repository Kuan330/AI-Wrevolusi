import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
let store = new Map(), owner = 1, fail = false, beforeCommit;
const storage = { getItem: key => store.get(key) ?? null, setItem: (key,value) => store.set(key,value), removeItem: key => store.delete(key) };
globalThis.__draftStorage = { accountStorage: storage, currentWorkspaceSession: () => owner, hasAccountWorkspace: () => owner > 0,
 commitWorkspaceItems: async items => { const session=owner; if(beforeCommit) await beforeCommit(); if(fail) throw Error('offline'); if(session!==owner) throw Error('account changed'); for(const [k,v] of Object.entries(items)) v===null ? store.delete(k) : store.set(k,v); } };
const compile = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`;
const profileSource=readFileSync(new URL('../src/features/work-profile/userProfile.ts',import.meta.url),'utf8').replace('import { accountStorage } from "../../services/accountStorage.ts";', 'const { accountStorage } = globalThis.__draftStorage;');
const profileUrl=compile(profileSource);
const profile=await import(profileUrl);
const source=readFileSync(new URL('../src/features/work-profile/workProfileDraft.ts',import.meta.url),'utf8').replace(/import \{ accountStorage[^;]+;/,'const {accountStorage,commitWorkspaceItems,currentWorkspaceSession,hasAccountWorkspace} = globalThis.__draftStorage;').replace('"./userProfile.ts"',JSON.stringify(profileUrl));
const draft=await import(compile(source));
const key='aiwrevolusi.workProfileDraft.v1';
const task={id:'t1',wording:'Check mechanical drawings',source:'user'};
function reset(){store=new Map();owner=1;fail=false;beforeCommit=null;}
function seed(){profile.saveConfirmedAnalysis({occupationTitle:'Technician',occupationCode:'3115',occupationPath:[],tasks:[{...task,practice:{trials:[{id:'trial'}]}}],taskExposureAssessments:[]});}
test('own title confirms without research or catalogue occupation',async()=>{reset();draft.startWorkDraft();draft.updateWorkDraft({jobTitle:' Workshop helper ',tasks:[task]});const p=await draft.confirmWorkDraft();assert.equal(p.jobTitle,'Workshop helper');assert.equal(p.tasksOccupationCode,null);assert.equal(p.analysis,null);assert.equal(p.profileVersion,1);assert.equal(p.tasksConfirmed,true);assert.ok(p.confirmedAt);assert.equal(draft.readWorkDraft(),null);});
test('editing and cancelling keeps confirmed work and analysis unchanged',async()=>{reset();seed();const before=storage.getItem('aiwrevolusi.userProfile');draft.startWorkDraft('tasks');draft.updateWorkDraft({jobTitle:'New role',tasks:[]});assert.equal(storage.getItem('aiwrevolusi.userProfile'),before);await draft.discardWorkDraft();assert.equal(storage.getItem('aiwrevolusi.userProfile'),before);});
test('failed confirmation retains draft and old confirmed profile',async()=>{reset();seed();const before=storage.getItem('aiwrevolusi.userProfile');draft.startWorkDraft();draft.updateWorkDraft({tasks:[{...task,wording:'Inspect pumps'}]});fail=true;await assert.rejects(draft.confirmWorkDraft(),/offline/);assert.equal(storage.getItem('aiwrevolusi.userProfile'),before);assert.equal(draft.readWorkDraft().tasks[0].wording,'Inspect pumps');});
test('changed task archives original practice and preserves learning',async()=>{reset();seed();storage.setItem('aiwrevolusi.plan.courses.v1','saved learning');draft.startWorkDraft();draft.updateWorkDraft({tasks:[{...task,wording:'Inspect pumps'}]});const p=await draft.confirmWorkDraft();assert.equal(p.history[0].tasks[0].practice.trials[0].id,'trial');assert.equal(p.tasks[0].practice,undefined);assert.equal(p.analysis,null);assert.deepEqual(p.changedTaskIds,['t1']);assert.equal(storage.getItem('aiwrevolusi.plan.courses.v1'),'saved learning');});
test('title-only edit keeps research and unchanged task practice',async()=>{reset();seed();draft.startWorkDraft();draft.updateWorkDraft({jobTitle:'Senior technician'});draft.updateWorkDraft({occupation:draft.readWorkDraft().occupation});const p=await draft.confirmWorkDraft();assert.equal(p.analysis.occupationCode,'3115');assert.equal(p.tasks[0].practice.trials[0].id,'trial');assert.deepEqual(p.changedTaskIds,[]);});
test('malformed draft is preserved and never replaced',()=>{reset();storage.setItem(key,'{');assert.throws(()=>draft.startWorkDraft(),/could not be read/);assert.equal(storage.getItem(key),'{');});
test('empty tasks cannot confirm',async()=>{reset();draft.startWorkDraft();draft.updateWorkDraft({jobTitle:'Helper'});await assert.rejects(draft.confirmWorkDraft(),/at least one/);});
test('account change while confirming never publishes into the new account',async()=>{reset();draft.startWorkDraft();draft.updateWorkDraft({jobTitle:'Helper',tasks:[task]});beforeCommit=async()=>{owner=2;store=new Map();};await assert.rejects(draft.confirmWorkDraft(),/account changed/);assert.equal(store.size,0);});
test('legacy analysis copies title and tasks into an editable draft',()=>{reset();seed();storage.removeItem('aiwrevolusi.userProfile');const d=draft.startWorkDraft('tasks');assert.equal(d.jobTitle,'Technician');assert.equal(d.tasks[0].id,'t1');assert.equal(d.occupation.unit.occupation_code,'3115');});

test('legacy confirmed work without analysis keeps its optional reference code',()=>{reset();storage.setItem('aiwrevolusi.userProfile',JSON.stringify({tasks:[task],tasksOccupationCode:'3115',tasksConfirmed:true,analysis:null}));const d=draft.startWorkDraft();assert.equal(d.occupation.unit.occupation_code,'3115');assert.equal(d.jobTitle,'');});
test('changing reference clears old occupation means but retains wording and practice history',async()=>{reset();seed();const p=profile.readUserProfile();profile.writeUserProfile({tasks:p.tasks.map(t=>({...t,meanScore2025:0.7,potential25:'high'}))});draft.startWorkDraft();draft.updateWorkDraft({jobTitle:'New job',occupation:{unit:{occupation_code:'2221',title:'Nursing',description:null},path:[]}});const saved=await draft.confirmWorkDraft();assert.equal(saved.tasks[0].meanScore2025,null);assert.equal(saved.tasks[0].potential25,null);assert.equal(saved.tasks[0].wording,task.wording);assert.equal(saved.tasks[0].practice.trials[0].id,'trial');});

test('changing title requires an explicit reference decision before confirmation', async()=>{
 reset();seed();const before=storage.getItem('aiwrevolusi.userProfile');draft.startWorkDraft();
 draft.updateWorkDraft({jobTitle:'Primary school teacher'});
 assert.equal(draft.workDraftNeedsMatchReview(draft.readWorkDraft()),true);
 await assert.rejects(draft.confirmWorkDraft(),/Keep, replace or remove/);
 assert.equal(storage.getItem('aiwrevolusi.userProfile'),before);
 draft.updateWorkDraft({occupation:null});
 const saved=await draft.confirmWorkDraft();
 assert.equal(saved.jobTitle,'Primary school teacher');assert.equal(saved.tasksOccupationCode,null);
});
test('keeping or replacing the match records the title decision, but another change needs review',()=>{
 reset();seed();draft.startWorkDraft();draft.updateWorkDraft({jobTitle:'Lead technician'});
 draft.updateWorkDraft({occupation:draft.readWorkDraft().occupation});
 assert.equal(draft.workDraftNeedsMatchReview(draft.readWorkDraft()),false);
 draft.updateWorkDraft({jobTitle:'Teacher',occupation:{unit:{occupation_code:'2341',title:'Primary teachers'},path:[]}});
 assert.equal(draft.workDraftNeedsMatchReview(draft.readWorkDraft()),false);
 draft.updateWorkDraft({jobTitle:'Nurse'});assert.equal(draft.workDraftNeedsMatchReview(draft.readWorkDraft()),true);
});
test('case and whitespace corrections do not require reconfirming the same match',()=>{
 reset();seed();draft.startWorkDraft();draft.updateWorkDraft({jobTitle:'  TECHNICIAN  '});
 assert.equal(draft.workDraftNeedsMatchReview(draft.readWorkDraft()),false);
});
test('entering another draft step preserves edits and updates the resume stage',()=>{
 reset();seed();draft.startWorkDraft('job');draft.updateWorkDraft({jobTitle:'My title'});
 assert.equal(draft.startWorkDraft('tasks').stage,'tasks');
 assert.equal(draft.readWorkDraft().jobTitle,'My title');
 assert.equal(draft.startWorkDraft('job').stage,'job');
 assert.equal(draft.workDraftNeedsMatchReview(draft.readWorkDraft()),true);
});
