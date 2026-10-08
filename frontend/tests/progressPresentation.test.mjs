import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptChanges, comparisonRows, evidenceTimeline, progressErrorText, progressHeadline } from '../src/pages/Progress/progressPresentation.ts';
import { ApiError } from '../src/services/api.ts';
const attempt = (id, overrides={}) => ({id,date:'2026-09-29',type:'course_practice',description:'Try a sample',notes:'',task:null,...overrides});
const evidence = (overrides={}) => ({recorded_at:'2026-09-29T12:00:00Z',goal_wording:'Practice reports',skill:{label:'Reports',source:'personal',id:'s1',sourceVersion:null},task_evidence:[],confirmed_tasks:[],decision:null,study:[],course_practice:[],workplace_practice:[],completed_learning:[],gaps:[],...overrides});
const goal = (overrides={}) => ({goal_id:'g1',label:'Reports',status:'comparable',reason:'',earlier:evidence(),current:evidence(),...overrides});
test('failed reads, preparation and saves describe the actual operation',()=>{
 const failed=new ApiError('Request failed with status 500',500);
 assert.match(progressErrorText(failed,'load'),/could not load your saved reviews/);
 assert.doesNotMatch(progressErrorText(failed,'load'),/confirm that this review was saved/);
 assert.match(progressErrorText(failed,'prepare'),/could not prepare your progress review/);
 assert.match(progressErrorText(failed,'save'),/Retry to check this same review/);
});
test('only a save conflict asks for a fresh preview; safe source errors explain recovery',()=>{
 assert.match(progressErrorText(new ApiError('changed',409),'save'),/Refresh this preview/);
 assert.doesNotMatch(progressErrorText(new ApiError('changed',409),'load'),/Refresh this preview/);
 assert.match(progressErrorText(new ApiError('Saved progress source data is invalid.',422),'prepare'),/Saved progress source data is invalid/);
 assert.match(progressErrorText(new ApiError('Progress reviews are temporarily unavailable.',503),'load'),/temporarily unavailable/);
});
test('headline leads with a new attempt even when no study or workplace practice exists',()=>{
 const g=goal({current:evidence({course_practice:[attempt('a1')]})});
 assert.equal(progressHeadline([g]),'You added 1 new course or sample practice attempt');
 assert.deepEqual(attemptChanges(g).map(x=>x.kind),['added']);
});
test('correction to an existing id and removing a record never count as new attempts',()=>{
 const g=goal({earlier:evidence({course_practice:[attempt('a1'),attempt('a2')]}),current:evidence({course_practice:[attempt('a1',{notes:'Corrected note'})]})});
 assert.deepEqual(attemptChanges(g).map(x=>x.kind),['corrected','removed']);
 assert.equal(progressHeadline([g]),'Earlier activity records were corrected or removed');
 assert.equal(evidenceTimeline(g)[0].change,'corrected');
});
test('moving an attempt between activity groups is a correction, not an addition',()=>{
 const g=goal({earlier:evidence({course_practice:[attempt('a1')]}),current:evidence({workplace_practice:[attempt('a1',{type:'workplace_practice',task:{id:'t1',wording:'Real work'}})]})});
 assert.deepEqual(attemptChanges(g).map(x=>x.kind),['corrected']);
});
test('new goals, changed sources and resets do not contribute to the progress headline',()=>{
 for(const status of ['new_goal','starting_point','needs_starting_point','source_needs_review']){
  const g=goal({status,current:evidence({course_practice:[attempt('a1')]})});
  assert.deepEqual(attemptChanges(g),[]);
  assert.ok(comparisonRows(g).rows.every(r=>r.earlier===null));
  assert.doesNotMatch(progressHeadline([g]),/You added/);
  assert.equal(evidenceTimeline(g)[0].change,'recorded');
 }
});
test('paired bars use one scale and count attempts separately from linked completed courses',()=>{
 const g=goal({earlier:evidence({study:[attempt('s1',{type:'study'})]}),current:evidence({study:[attempt('s1',{type:'study'}),attempt('s2',{type:'study'})],course_practice:[attempt('p1')],completed_learning:[{id:'c1',title:'Course',completed_at:null,source_label:'Reported complete'}]})});
 const {rows,scale}=comparisonRows(g);
 assert.equal(scale,2);
 assert.deepEqual(rows.map(r=>[r.label,r.earlier,r.value]),[['Study',1,2],['Course or sample practice',0,1],['Workplace practice',0,0],['Reported completed learning',0,1]]);
});
test('a retained workplace attempt without confirmed work stays on the timeline but is excluded from current evidence counts',()=>{
 const g=goal({status:'starting_point',earlier:null,current:evidence({workplace_practice:[attempt('work',{type:'workplace_practice',task:{id:'t1',wording:'Prepare reports'}})],current_workplace_practice_count:0})});
 assert.equal(comparisonRows(g).rows.find(r=>r.key==='workplace_practice').value,0);
 assert.equal(evidenceTimeline(g).length,1);
});
test('timeline keeps date order and distinguishes existing records from new attempts',()=>{
 const g=goal({earlier:evidence({course_practice:[attempt('a1')]}),current:evidence({course_practice:[attempt('a1'),attempt('a2',{date:'2026-09-30'})]})});
 assert.deepEqual(evidenceTimeline(g).map(x=>[x.attempt.id,x.change]),[['a2','added'],['a1','recorded']]);
});
test('attempt IDs are compared within their own goal, even if another goal reuses an id',()=>{
 const old=goal({goal_id:'g1',earlier:evidence({course_practice:[attempt('a1')]}),current:evidence({course_practice:[attempt('a1')]})});
 const newOne=goal({goal_id:'g2',current:evidence({course_practice:[attempt('a1')]})});
 assert.equal(progressHeadline([old,newOne]),'You added 1 new course or sample practice attempt');
});

test('a newly linked completed course leads the summary without claiming skill mastery',()=>{
 const g=goal({current:evidence({completed_learning:[{id:'c1',title:'Course',completed_at:null,source_label:'Reported complete'}]})});
 assert.equal(progressHeadline([g]),'You recorded 1 new course completion');
});

import { saveBlockedReason } from '../src/pages/Progress/progressPresentation.ts';
test('the save button always has a plain reason beside it while it is blocked', () => {
  const ok = { can_save: true, goals: [{ status: 'ready' }], required_reset_goal_ids: [] };
  assert.equal(saveBlockedReason(ok, false), '');
  assert.match(saveBlockedReason({ ...ok, can_save: false, goals: [{ status: 'source_needs_review' }] }, false), /source check/);
  assert.match(saveBlockedReason({ ...ok, can_save: false }, false), /nothing new to save/i);
  assert.match(saveBlockedReason({ ...ok, required_reset_goal_ids: ['g1'] }, false), /Tick the box/);
  assert.equal(saveBlockedReason({ ...ok, required_reset_goal_ids: ['g1'] }, true), '');
});
