import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingLearningInterests } from '../src/pages/Skills/lib/pendingLearningInterests.ts';
const uri = 'http://data.europa.eu/esco/skill/11111111-1111-1111-1111-111111111111';
const specialist = { taskId:'t1',taskWording:'Write software tests',occupationCode:'2512',skillUri:uri,skillLabel:'Write tests',sourceVersion:'1.2.0',decision:null,wantsLearning:true,updatedAt:'2026-09-30T00:00:00Z' };
const personal = { id:'p1',name:'Test my own reporting tool',taskIds:['t1'],taskLabels:['Write software tests'],workKey:'work',wantsLearning:true,updatedAt:'2026-09-30T00:00:00Z' };
const input = () => ({ tasks:[{id:'t1',wording:'Write software tests'}],tasksConfirmed:true,occupationCode:'2512',specialist:[specialist],personal:[personal],sourceVersion:'1.2.0',goalSourceKeys:[] });
test('current saved interests can continue without a second focus selection', () => {
 const result=pendingLearningInterests(input());
 assert.deepEqual(result.specialist,[specialist]); assert.deepEqual(result.personal,[personal]); assert.equal(result.stale,0);
});
test('catalogue interests wait for a checked source version while personal choices stay available', () => {
 const result=pendingLearningInterests({...input(),sourceVersion:null});
 assert.equal(result.specialist.length,0); assert.equal(result.checking,1); assert.equal(result.personal.length,1); assert.equal(result.stale,0);
});
test('changed source, task, occupation and unconfirmed work never become fresh interests', () => {
 for (const patch of [{sourceVersion:'1.2.1'},{tasks:[{id:'t1',wording:'Test a new task'}]},{occupationCode:'9999'},{tasksConfirmed:false}]) {
  const result=pendingLearningInterests({...input(),...patch}); assert.equal(result.specialist.length,0); assert.ok(result.stale>0);
 }
 const result=pendingLearningInterests({...input(),tasksConfirmed:false}); assert.equal(result.personal.length,0);
});
test('goals already created and withdrawn interests do not show another create prompt', () => {
 const result=pendingLearningInterests({...input(),goalSourceKeys:[`specialist:${JSON.stringify(['t1',uri])}`,'personal:p1']});
 assert.deepEqual(result,{specialist:[],personal:[],checking:0,stale:0});
 assert.equal(pendingLearningInterests({...input(),specialist:[{...specialist,wantsLearning:false}],personal:[]}).specialist.length,0);
});
