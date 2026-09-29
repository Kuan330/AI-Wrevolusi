import test from 'node:test';
import assert from 'node:assert/strict';
import { readGoalDraft, writeGoalDraft, goalDraftKey, draftNeedsReview, clearDraftPart, parseGoalDraft, attemptTaskOptions, taskIdentity } from '../src/features/learning-goals/goalDraft.ts';
const memory = () => { const values = new Map(); return { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) }; };
const pending = () => ({version:1,owner:'alice',goalId:'g1',baseRevision:3,wording:'My unfinished goal',action:{kind:'practise',text:'Try a small task'},attempt:{id:'attempt-1',editing:true,date:'2026-01-01',type:'workplace_practice',description:'Tried the task',notes:'Needs a correction',task:{id:'task-1',wording:'Original work task'}}});
test('reload restores all unsaved parts only for the same account and goal',()=>{
 const storage=memory(); const draft=pending(); writeGoalDraft(storage,'alice','g1',draft);
 assert.deepEqual(readGoalDraft(storage,'alice','g1'),draft);
 assert.equal(readGoalDraft(storage,'bob','g1'),null);
 assert.equal(readGoalDraft(storage,'alice','g2'),null);
 assert.throws(()=>writeGoalDraft(storage,'bob','g1',draft),/different account/);
});
test('newer saved evidence requires review and is never merged automatically with a draft',()=>{
 const draft=pending(); assert.equal(draftNeedsReview(draft,3),false); assert.equal(draftNeedsReview(draft,4),true);
 assert.equal(draft.baseRevision,3); assert.equal(draft.attempt.description,'Tried the task');
});
test('successful action save clears only its draft and preserves unfinished wording and attempt',()=>{
 const storage=memory();const remaining=clearDraftPart(pending(),'action',4);writeGoalDraft(storage,'alice','g1',remaining);
 const restored=readGoalDraft(storage,'alice','g1');assert.equal(restored.action,undefined);assert.equal(restored.wording,'My unfinished goal');assert.equal(restored.attempt.notes,'Needs a correction');assert.equal(restored.baseRevision,4);
});
test('corrupt or wrongly owned drafts are not replaced silently',()=>{
 const storage=memory(); const key=goalDraftKey('alice','g1');storage.setItem(key,'{');
 assert.throws(()=>readGoalDraft(storage,'alice','g1'),/could not be read/);assert.equal(storage.getItem(key),'{');
 assert.throws(()=>parseGoalDraft(JSON.stringify(pending()),'bob','g1'),/could not be read/);
 writeGoalDraft(storage,'alice','g1',null);assert.equal(storage.getItem(key),null);
});
test('storage failure is reported so the caller must not promise reload recovery',()=>{
 const storage=memory();storage.setItem=()=>{throw Error('Quota reached')};
 assert.throws(()=>writeGoalDraft(storage,'alice','g1',pending()),/Quota reached/);
});
test('task corrections offer historical and current wording with separate identities',()=>{
 const historical={id:'t1',wording:'Old wording'};const current={id:'t1',wording:'Corrected wording'};
 const options=attemptTaskOptions([current],historical);assert.equal(options.length,2);assert.equal(options[0].historical,true);assert.equal(options[1].historical,false);
 assert.notEqual(taskIdentity(options[0].task),taskIdentity(options[1].task));assert.equal(attemptTaskOptions([current],current).length,1);
});
test('changed work context requires review even when the goal revision is unchanged',()=>{
 const draft={...pending(),baseContext:'old task wording'};
 assert.equal(draftNeedsReview(draft,3,'old task wording'),false);
 assert.equal(draftNeedsReview(draft,3,'new task wording'),true);
});
test('corrupt enum arrays cannot be restored as a supported action or attempt type',()=>{
 const action=pending();action.action.kind=['practise'];assert.throws(()=>parseGoalDraft(JSON.stringify(action),'alice','g1'),/could not be read/);
 const attempt=pending();attempt.attempt.type=['study'];assert.throws(()=>parseGoalDraft(JSON.stringify(attempt),'alice','g1'),/could not be read/);
});
