import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSkillsOverview } from '../src/pages/Skills/lib/skillsOverview.ts';

const uri = 'http://data.europa.eu/esco/skill/11111111-1111-1111-1111-111111111111';
const tasks = [{id:'t1',wording:'Write software tests'}, {id:'t2',wording:'Review test results'}];
const skill = {uri,label:'Software testing',skill_type:'skill',aliases:[],description:'Test software',relation:null};
const entry = (taskId='t1', patch={}) => ({taskId,taskWording:tasks.find(t=>t.id===taskId)?.wording,occupationCode:'2512',skillUri:uri,skillLabel:'Software testing',sourceVersion:'1.2.0',decision:'use',wantsLearning:false,updatedAt:'2026-09-30T00:00:00Z',...patch});
const base = patch => ({tasks,occupationCode:'2512',specialist:[],personal:[],broad:[],decisions:{},broadNeedsReview:false,candidates:[],goals:[],catalogueVersion:'1.2.0',...patch});

test('one source concept across tasks preserves different statements and counts once', () => {
 const result=buildSkillsOverview(base({specialist:[entry(),entry('t2',{decision:'no',wantsLearning:true})],candidates:[{taskId:'t1',taskWording:tasks[0].wording,version:'1.2.0',skills:[skill,skill]}]}));
 assert.equal(result.rows.length,1); assert.equal(result.rows[0].tasks.length,2);
 assert.deepEqual(result.rows[0].tasks.map(t=>t.decision),['use','no']);
 assert.equal(result.counts.confirmed,1); assert.equal(result.counts.wantsLearning,1); assert.equal(result.counts.suggested,0); assert.equal(result.rows[0].kind,'skill');
});
test('catalogue outage keeps saved self reports visible without saying source is checked', () => {
 const result=buildSkillsOverview(base({catalogueVersion:null,specialist:[entry()]}));
 assert.equal(result.rows[0].sourceCheck,true); assert.equal(result.rows[0].confirmed,true);
 assert.equal(result.rows[0].kind,'unknown'); assert.equal(result.rows[0].needsReview,false);
});
test('changed work and source versions never become current use or learning counts', () => {
 for (const patch of [{occupationCode:'9999'}, {tasks:[{id:'t1',wording:'Changed task'}]}, {catalogueVersion:'1.2.1'}]) {
  const result=buildSkillsOverview(base({...patch,specialist:[entry('t1',{wantsLearning:true})]}));
  assert.equal(result.counts.confirmed,0); assert.equal(result.counts.wantsLearning,0); assert.equal(result.counts.needsReview,1); assert.deepEqual(result.currentTaskIds,[]);
 }
});
test('suggestions remain suggestions and knowledge is labelled without implying ability', () => {
 const result=buildSkillsOverview(base({candidates:[{taskId:'t1',taskWording:tasks[0].wording,version:'1.2.0',skills:[{...skill,skill_type:'knowledge'}]}]}));
 assert.equal(result.rows[0].kind,'knowledge'); assert.equal(result.counts.suggested,1); assert.equal(result.counts.confirmed,0); assert.equal(result.counts.reportedUse,0);
});
test('equal labels across sources stay separate and broad acceptance is not reported use', () => {
 const result=buildSkillsOverview(base({specialist:[entry()],personal:[{id:'p1',name:'Software testing',taskIds:['t1'],taskLabels:[tasks[0].wording],decision:'unsure'}],broad:[{skill:{wef_skill_id:6,core_skill:'Software testing'},tasks}],decisions:{6:'accepted'}}));
 assert.equal(result.counts.total,3); assert.equal(result.counts.confirmed,2); assert.equal(result.counts.reportedUse,1);
 assert.equal(result.rows.find(r=>r.source==='wef').tasks.length,2);
});
test('old WEF acceptance needs review and a rejected match remains rejected', () => {
 const evidence=[{skill:{wef_skill_id:6,core_skill:'Digital skills'},tasks}];
 const accepted=buildSkillsOverview(base({broad:evidence,decisions:{6:'accepted'},broadNeedsReview:true}));
 assert.equal(accepted.counts.confirmed,0); assert.equal(accepted.counts.needsReview,1);
 const rejected=buildSkillsOverview(base({broad:evidence,decisions:{6:'rejected'},broadNeedsReview:true}));
 assert.equal(rejected.counts.suggested,0); assert.equal(rejected.counts.needsReview,0); assert.equal(rejected.rows[0].tasks[0].decision,'rejected');
});
test('goals join existing identities without inventing extra current skills', () => {
 const goals=[{id:'g1',sourceKey:`specialist:${JSON.stringify(['t1',uri])}`,wording:'Learn testing',initial:{skill:{source:'esco',id:uri,label:'Testing'}}}, {id:'g2',sourceKey:'personal:p2',wording:'Old goal',initial:{skill:{source:'personal',id:'p2',label:'Old skill'}}}];
 const result=buildSkillsOverview(base({specialist:[entry()],goals}));
 assert.equal(result.rows.length,1); assert.deepEqual(result.rows[0].goalIds,['g1']);
});
test('stale statements remain separate when a fresh candidate uses the same URI and task', () => {
 const result=buildSkillsOverview(base({specialist:[entry('t1',{occupationCode:'9999',wantsLearning:true})],candidates:[{taskId:'t1',taskWording:tasks[0].wording,version:'1.2.0',skills:[skill]}]}));
 assert.equal(result.rows[0].tasks.length,2); assert.equal(result.counts.confirmed,0); assert.equal(result.counts.suggested,1); assert.equal(result.counts.needsReview,1);
 assert.equal(result.rows[0].wantsLearning,false); assert.equal(result.counts.wantsLearning,0);
 assert.equal(result.rows[0].tasks.find(task=>task.needsReview).wantsLearning,true);
 assert.equal(result.rows[0].tasks.find(task=>!task.needsReview).wantsLearning,false);
});
test('old candidate task wording is ignored while multiple personal task links are retained', () => {
 const result=buildSkillsOverview(base({candidates:[{taskId:'t1',taskWording:'Old task',version:'1.2.0',skills:[skill]}],personal:[{id:'p1',name:'Reporting',taskIds:['t1','t2'],taskLabels:[tasks[0].wording,'Previous wording'],decision:'use',wantsLearning:true}]}));
 assert.equal(result.rows.length,1); assert.deepEqual(result.rows[0].currentTaskIds,['t1']); assert.equal(result.rows[0].tasks[1].needsReview,true); assert.equal(result.counts.reportedUse,1);
});
