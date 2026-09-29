import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let stored,profile,entry,fail,context,contextNeedsReview,personal;
const source=readFileSync(new URL('../src/features/learning-goals/learningGoals.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')+'\nreturn {readLearningGoals,parseLearningGoals,createPersonalGoal,createSpecialistGoal,createContextGoal,updateLearningGoal,saveLearningAttempt,removeLearningAttempt,goalContextWarnings};';
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/export /g,'');
const api=new Function('accountStorage','commitWorkspaceItems','currentWorkspaceSession','readJourneyProfile','readLearningContext','learningContextNeedsReview','readSpecialistState','specialistEntryKey','specialistEntryIsCurrent','readJourneyState','personalSkillIsCurrent',compiled)({getItem:k=>stored.get(k)??null},async values=>{if(fail)throw Error('save failed');for(const [k,v] of Object.entries(values))stored.set(k,v);},()=>1,()=>profile,id=>context?.id===id?context:null,()=>contextNeedsReview,()=>({entries:[entry]}),e=>JSON.stringify([e.taskId,e.skillUri]),(e,ts,code)=>code===e.occupationCode&&ts.some(t=>t.id===e.taskId&&t.wording===e.taskWording),()=>({personalSkills:personal?[personal]:[]}),e=>profile.tasksConfirmed&&e.taskIds.every((id,i)=>profile.tasks.some(t=>t.id===id&&t.wording===e.taskLabels[i])));
beforeEach(()=>{stored=new Map();personal=null;fail=false;context=null;contextNeedsReview=false;entry={taskId:'t1',taskWording:'Prepare reports',occupationCode:'3115',skillUri:'http://data.europa.eu/esco/skill/12345678-1234-1234-1234-123456789abc',skillLabel:'Write reports',sourceVersion:'1.2.0',sourceOccupationUri:null,decision:null,wantsLearning:true,updatedAt:'2026-09-29T00:00:00Z'};profile={tasksConfirmed:true,tasksOccupationCode:'3115',tasks:[{id:'t1',wording:'Prepare reports'}]};});
test('creation is idempotent and keeps missing career link honest',async()=>{const g=await api.createSpecialistGoal(entry);assert.equal((await api.createSpecialistGoal(entry)).id,g.id);assert.equal(g.initial.career,null);assert.equal(g.initial.decision,null);assert.equal(api.readLearningGoals().length,1);});
test('study without action or course saves and failed save retains records',async()=>{const g=await api.createSpecialistGoal(entry);fail=true;await assert.rejects(api.saveLearningAttempt(g.id,{id:'a1',date:'2026-01-01',type:'study',description:'Read a guide'}));assert.equal(api.readLearningGoals()[0].attempts.length,0);fail=false;await api.saveLearningAttempt(g.id,{id:'a1',date:'2026-01-01',type:'study',description:'Read a guide'});assert.equal(api.readLearningGoals()[0].action,null);});
test('workplace practice requires a real task and course practice does not invent one',async()=>{const g=await api.createSpecialistGoal(entry);await assert.rejects(api.saveLearningAttempt(g.id,{date:'2026-01-01',type:'workplace_practice',description:'Tried'}),/real work task/);await api.saveLearningAttempt(g.id,{date:'2026-01-01',type:'course_practice',description:'Tried'});assert.equal(api.readLearningGoals()[0].attempts[0].task,null);});
test('correction and removal retain old evidence and baseline and mark review',async()=>{const g=await api.createSpecialistGoal(entry);const input={id:'a1',date:'2026-01-01',type:'study',description:'Read'};await api.saveLearningAttempt(g.id,input);await api.saveLearningAttempt(g.id,input);assert.equal(api.readLearningGoals()[0].revision,2);await api.saveLearningAttempt(g.id,{...input,description:'Read chapter one'});await api.removeLearningAttempt(g.id,'a1');const saved=api.readLearningGoals()[0];assert.deepEqual(saved.initial,g.initial);assert.equal(saved.attempts.length,0);assert.equal(saved.history.at(-1).attempts[0].description,'Read chapter one');assert.ok(saved.needsReview);});
test('changed source warns and requires explicit new baseline',async()=>{const g=await api.createSpecialistGoal(entry);entry={...entry,sourceVersion:'1.3.0'};assert.equal(api.goalContextWarnings(g).length,1);await assert.rejects(api.createSpecialistGoal(entry),/changed/);await api.createSpecialistGoal(entry,{newGoal:true});assert.equal(api.readLearningGoals().length,2);});
test('corrupt storage and invalid dates cannot replace saved work',async()=>{const g=await api.createSpecialistGoal(entry);for(const date of ['2026-02-30','2999-01-01'])await assert.rejects(api.saveLearningAttempt(g.id,{date,type:'study',description:'Read'}));stored.set('aiwrevolusi.learningGoals.v1','{');assert.throws(api.readLearningGoals,/could not be read/);});

const savedContext = (origin) => ({
 id:'context-1',origin,skill:{source:'wef',id:1,slug:'analytical-thinking',name:'Analytical thinking'},
 taskIds:origin==='work'?['t1']:[],taskLabels:origin==='work'?['Prepare reports']:[],
 ...(origin==='career'?{career:{code:'1234',title:'Sales manager'}}:{}),
 goal:'Build a clearer analysis',workKey:'saved-work-context',createdAt:'2026-01-01T00:00:00Z',
});
test('WEF work carries task evidence and decision without inventing a source version',async()=>{
 context=savedContext('work');
 const goal=await api.createContextGoal(context);
 assert.deepEqual(goal.initial.skill,{source:'wef',id:'1',label:'Analytical thinking',sourceVersion:null});
 assert.deepEqual(goal.initial.tasks,[{id:'t1',wording:'Prepare reports'}]);
 assert.equal(goal.initial.decision,'accepted');
 assert.equal(goal.initial.career,null);
 assert.equal(goal.initial.workKey,context.workKey);
 assert.equal(goal.wording,context.goal);
 assert.equal((await api.createContextGoal(context)).id,goal.id);
});
test('WEF career carries the saved career reason without inventing current work evidence',async()=>{
 context=savedContext('career');
 const goal=await api.createContextGoal(context);
 assert.deepEqual(goal.initial.career,context.career);
 assert.deepEqual(goal.initial.tasks,[]);
 assert.equal(goal.initial.decision,null);
 assert.equal(goal.initial.sourceOccupationUri,null);
 assert.equal(goal.initial.skill.sourceVersion,null);
});
test('WEF browse preserves missing task and career evidence and fallback goal wording',async()=>{
 context={...savedContext('browse'),goal:''};
 const goal=await api.createContextGoal(context);
 assert.deepEqual(goal.initial.tasks,[]);
 assert.equal(goal.initial.career,null);
 assert.equal(goal.initial.decision,null);
 assert.equal(goal.initial.skill.sourceVersion,null);
 assert.equal(goal.wording,'Develop Analytical thinking');
 assert.match(api.goalContextWarnings(goal).join(' '),/No confirmed work task or career reason/);
});
test('WEF stale or replaced source cannot create a goal until reviewed',async()=>{
 context=savedContext('work');contextNeedsReview=true;
 await assert.rejects(api.createContextGoal(context),/current work/);
 contextNeedsReview=false;
 await assert.rejects(api.createContextGoal({...context,goal:'Unsaved change'}),/changed/);
 assert.equal(api.readLearningGoals().length,0);
});
test('mutating returned source snapshot cannot alter the persisted starting record',async()=>{
 context=savedContext('career');
 const goal=await api.createContextGoal(context);
 goal.initial.career.title='Changed outside storage';
 context.skill.name='Changed source outside storage';
 const persisted=api.readLearningGoals()[0];
 assert.equal(persisted.initial.career.title,'Sales manager');
 assert.equal(persisted.initial.skill.label,'Analytical thinking');
});

test('corrupt enum arrays cannot masquerade as supported evidence or action types',async()=>{
 const goal=await api.createSpecialistGoal(entry);
 await api.updateLearningGoal(goal.id,{action:{kind:'understand',text:'Read a guide'}});
 await api.saveLearningAttempt(goal.id,{date:'2026-01-01',type:'study',description:'Read a guide'});
 const saved=api.readLearningGoals();
 for(const corrupt of [
  g=>g.action.kind=['understand'],
  g=>g.attempts[0].type=['study'],
  g=>g.initial.skill.source=['esco'],
  g=>g.initial.origin=['work'],
  g=>g.initial.decision=['use'],
 ]) {
  const goals=structuredClone(saved);corrupt(goals[0]);
  assert.throws(()=>api.parseLearningGoals(JSON.stringify({version:1,goals})),/could not be read/);
 }
});

const personalEntry = () => ({id:'p1',name:'My local reporting method',taskIds:['t1'],taskLabels:['Prepare reports'],workKey:'original-work',updatedAt:'2026-01-01T00:00:00Z',wantsLearning:true});
test('personal learning carries exact user evidence without inventing catalogue identity or ability',async()=>{
 personal=personalEntry();
 const goal=await api.createPersonalGoal(personal);
 assert.deepEqual(goal.initial.skill,{source:'personal',id:'p1',label:personal.name,sourceVersion:null});
 assert.equal(goal.initial.decision,null);assert.equal(goal.initial.career,null);assert.equal(goal.initial.sourceOccupationUri,null);
 assert.deepEqual(goal.initial.tasks,[{id:'t1',wording:'Prepare reports'}]);
 assert.equal((await api.createPersonalGoal(personal)).id,goal.id);
 await api.saveLearningAttempt(goal.id,{date:'2026-01-01',type:'study',description:'Read my notes'});
 personal={...personal,decision:'unsure'};
 assert.ok(api.goalContextWarnings(goal).length);
 await assert.rejects(api.createPersonalGoal(personal),/changed/);
 const next=await api.createPersonalGoal(personal,{newGoal:true});assert.equal(next.initial.decision,'unsure');
 assert.equal(api.readLearningGoals()[0].attempts.length,1);
});
test('personal goal rejects unsaved interest stale task and failed save without replacing records',async()=>{
 personal={...personalEntry(),wantsLearning:false};await assert.rejects(api.createPersonalGoal(personal),/learning interest/);
 personal=personalEntry();profile.tasks[0].wording='Changed task';await assert.rejects(api.createPersonalGoal(personal),/current task/);
 profile.tasks[0].wording='Prepare reports';fail=true;await assert.rejects(api.createPersonalGoal(personal),/save failed/);
 assert.equal(api.readLearningGoals().length,0);
});
