import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { accountStorage, activateWorkspace } from '../src/services/accountStorage.ts';
import { readPlanState, savePlanState } from '../src/features/learning-planning/planCourses.ts';
import { checkInToPlan, saveChapterProgress, syncChapterProgress, refreshChapterProgress } from '../src/features/learning-planning/progressOperations.ts';
import { loadCourseDirectory, loadLearningCatalogue, resetCourseDirectory } from '../src/features/learning-planning/courseDirectory.ts';
import { changeSavedCourses } from '../src/features/learning-planning/courseOperations.ts';
const planKey = 'aiwrevolusi.plan.courses.v1';
const memory = new Map();
const day = '2026-09-18';
const initial = () => ({ version: 1, courses: [{ id: 'c', title: 'Course', provider: 'Provider', skillId: 'writing', chapters: [{ title: 'One', value: 0 }] }], records: {} });
const row = value => ({ skill_id: 'writing', course_id: 'c', chapter_index: 0, value });
const response = data => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const realNow = Date.now;
beforeEach(() => {
  memory.clear();
  globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
  globalThis.window = new EventTarget();
  activateWorkspace('one', { data: { [planKey]: JSON.stringify(initial()) }, revision: 0 });
  resetCourseDirectory();
  globalThis.fetch = async () => { throw new Error('Offline'); };
});
afterEach(() => { activateWorkspace(null); Date.now = realNow; });

test('late check-in uses fresh records and preserves a concurrent course edit', async () => {
  const pending=deferred(); globalThis.fetch=()=>pending.promise;
  const operation=checkInToPlan(day);
  await Promise.resolve(); await Promise.resolve();
  const changed=readPlanState(); changed.courses[0].chapters[0].value=7; changed.records[day]={minutes:40,note:'Keep note',studied:true,checked:false}; savePlanState(changed);
  pending.resolve(response({created:true,streak_days:1,checked_on:day}));
  const result=await operation;
  assert.equal(result.state.courses[0].chapters[0].value,7);
  assert.equal(result.state.records[day].note,'Keep note');
  assert.equal(result.state.records[day].checked,true);
});

test('late check-in cannot write old records into a new account', async () => {
  const pending=deferred(); globalThis.fetch=()=>pending.promise;
  const operation=checkInToPlan(day);
  await Promise.resolve(); await Promise.resolve();
  activateWorkspace('two',{data:{},revision:4});
  pending.resolve(response({created:true,streak_days:1,checked_on:day}));
  await assert.rejects(operation,/account changed/);
  assert.equal(accountStorage.getItem(planKey),null);
});

test('failed progress remains pending and retry reconciles a higher server value', async () => {
  saveChapterProgress('c',[5],day);
  await assert.rejects(syncChapterProgress(),/Offline/);
  assert.equal(readPlanState().pendingProgress[0].value,5);
  assert.match(readPlanState().progressSyncError,/Offline/);
  globalThis.fetch=async()=>response({accepted:0,updated:[],rejected:[{course_id:'c',chapter_index:0,reason:'not_increase',stored_value:8}]});
  const synced=await syncChapterProgress();
  assert.equal(synced.courses[0].chapters[0].value,8);
  assert.deepEqual(synced.pendingProgress,[]);
  assert.equal(synced.progressSyncError,'');
});

test('an unaccepted chapter is kept for retry rather than reported as synced', async () => {
  saveChapterProgress('c',[5],day);
  globalThis.fetch=async()=>response({accepted:0,updated:[],rejected:[{course_id:'c',chapter_index:0,reason:'unknown_scope'}]});
  await assert.rejects(syncChapterProgress(),/not accepted/);
  assert.equal(readPlanState().courses[0].chapters[0].value,5);
  assert.equal(readPlanState().pendingProgress.length,1);
});

test('failed local storage leaves the saved plan unchanged and never sends progress', () => {
  const previous=accountStorage.getItem(planKey);
  let requests=0; globalThis.fetch=async()=>{requests++;throw new Error('should not call')};
  localStorage.setItem=()=>{throw new Error('Storage unavailable')};
  assert.throws(()=>saveChapterProgress('c',[5],day),/Storage unavailable/);
  assert.equal(accountStorage.getItem(planKey),previous);
  assert.equal(requests,0);
});

test('new progress during a request is retained and sent in the next batch', async () => {
  saveChapterProgress('c',[5],day);
  const pending=deferred(); const sent=[];
  globalThis.fetch=async(_url,init)=>{ const body=JSON.parse(init.body); sent.push(body); return sent.length===1?pending.promise:response({accepted:1,updated:[row(8)],rejected:[]}); };
  const sync=syncChapterProgress();
  saveChapterProgress('c',[8],day);
  pending.resolve(response({accepted:1,updated:[row(5)],rejected:[]}));
  const next=await sync;
  assert.deepEqual(sent.map(body=>body.chapters[0].value),[5,8]);
  assert.equal(next.courses[0].chapters[0].value,8);
  assert.deepEqual(next.pendingProgress,[]);
});

test('late progress acknowledgement never restores an explicitly removed course', async () => {
  saveChapterProgress('c',[5],day);
  const pending=deferred(); globalThis.fetch=()=>pending.promise;
  const sync=syncChapterProgress();
  await changeSavedCourses({remove:['c']});
  pending.resolve(response({accepted:1,updated:[row(5)],rejected:[]}));
  assert.deepEqual((await sync).courses,[]);
});

test('authoritative reads raise saved values without lowering drafts or clearing pending days', async () => {
  saveChapterProgress('c',[5],day);
  globalThis.fetch=async()=>response({chapters:[row(8)]});
  let state=await refreshChapterProgress();
  assert.equal(state.courses[0].chapters[0].value,8);
  assert.equal(state.pendingProgress[0].local_date,day);
  globalThis.fetch=async()=>response({chapters:[row(2)]});
  state=await refreshChapterProgress();
  assert.equal(state.courses[0].chapters[0].value,8);
});

test('an old progress read cannot change the new account', async () => {
  const pending=deferred(); globalThis.fetch=()=>pending.promise;
  const read=refreshChapterProgress();
  activateWorkspace('two',{data:{},revision:0}); pending.resolve(response({chapters:[row(8)]}));
  await assert.rejects(read,/account changed/);
  assert.equal(accountStorage.getItem(planKey),null);
});

test('catalogue refresh is shared by the page and save operation and expires after one minute', async () => {
  let clock=1000; Date.now=()=>clock; let version=1; let calls=0;
  globalThis.fetch=async()=>{calls++; return response({found:true,courses:[{course_id:`c${version}`,skill_id:'writing',title:'Course',chapters:[]}]});};
  const first=await loadLearningCatalogue('writing');
  assert.equal(first.courses[0].id,'c1');
  version=2;
  assert.equal((await loadCourseDirectory()).has('c1'),true);
  assert.equal(calls,1);
  clock+=60001;
  assert.equal((await loadLearningCatalogue('writing')).courses[0].id,'c2');
  await changeSavedCourses({add:['c2']});
  assert.equal(calls,2);
  version=3; resetCourseDirectory();
  assert.equal((await loadLearningCatalogue('writing')).courses[0].id,'c3');
  assert.equal((await loadCourseDirectory()).has('c3'),true);
});

test('a progress response from the previous account cannot persist its result', async () => {
  saveChapterProgress('c',[5],day);
  const pending=deferred(); globalThis.fetch=()=>pending.promise;
  const sync=syncChapterProgress();
  activateWorkspace('two',{data:{},revision:0});
  pending.resolve(response({accepted:1,updated:[row(5)],rejected:[]}));
  await assert.rejects(sync,/account changed/);
  assert.equal(accountStorage.getItem(planKey),null);
});

test('storage failure after server acknowledgement retains pending data and rejects success', async () => {
  saveChapterProgress('c',[5],day);
  globalThis.fetch=async()=>{ localStorage.setItem=()=>{throw new Error('Cache failed')}; return response({accepted:1,updated:[row(5)],rejected:[]}); };
  await assert.rejects(syncChapterProgress(),/Cache failed/);
  assert.equal(readPlanState().pendingProgress[0].value,5);
});

test('removing a course cancels pending writes and ignores a later rejected response', async () => {
  saveChapterProgress('c',[5],day);
  const pending=deferred(); globalThis.fetch=()=>pending.promise;
  const sync=syncChapterProgress();
  const removed=await changeSavedCourses({remove:['c']});
  assert.deepEqual(removed.plan.pendingProgress,[]);
  pending.resolve(response({accepted:0,updated:[],rejected:[{course_id:'c',chapter_index:0,reason:'unknown_scope'}]}));
  const final=await sync;
  assert.deepEqual(final.courses,[]);
  assert.deepEqual(final.pendingProgress,[]);
  assert.equal(final.progressSyncError,'');
});

test('progress queues are split by date and at most 200 chapters per request', async () => {
  const state=initial();
  state.courses[0].chapters=Array.from({length:450},(_,i)=>({title:`Chapter ${i}`,value:1}));
  state.pendingProgress=state.courses[0].chapters.map((_,i)=>({...row(1),chapter_index:i,local_date:i<420?day:'2026-09-17'}));
  savePlanState(state);
  const batches=[];
  globalThis.fetch=async(_url,init)=>{const body=JSON.parse(init.body);batches.push(body);assert.ok(body.chapters.length<=200);return response({accepted:body.chapters.length,updated:body.chapters,rejected:[]});};
  const final=await syncChapterProgress();
  assert.deepEqual(batches.map(b=>b.chapters.length),[200,200,20,30]);
  assert.deepEqual(batches.map(b=>b.local_date),[day,day,day,'2026-09-17']);
  assert.equal(new Set(batches.flatMap(b=>b.chapters.map(c=>c.chapter_index))).size,450);
  assert.deepEqual(final.pendingProgress,[]);
});
