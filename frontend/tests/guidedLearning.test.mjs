import test from 'node:test';
import assert from 'node:assert/strict';
import { taskSuggestionsAreCurrent, plannedActivityAttempt, templateGoalSuggestion } from '../src/features/learning-goals/guidedLearning.ts';
import { guidedLearningService } from '../src/services/guidedLearningService.ts';
const task={id:'t1',wording:'Prepare monthly sales reports and explain changes.'};
const goal={id:'g1',revision:1,initial:{skill:{label:'analyse data'},tasks:[task]},action:{kind:'practise',text:'Try a fictional sample report',origin:'ai_suggestion'},attempts:[]};

test('task request preserves the complete confirmed wording beyond search limits',async()=>{
 const previous=globalThis.fetch;let payload;
 globalThis.fetch=async (_url,options)=>{payload=JSON.parse(options.body);return new Response('{}',{headers:{'Content-Type':'application/json'}})};
 try {const wording='Analyse records. '.repeat(150);await guidedLearningService.forTask({id:'t1',wording});assert.equal(payload.expected_wording,wording);assert.equal(payload.task_id,'t1');}finally{globalThis.fetch=previous}
});
test('a task response cannot be shown for changed wording or fabricated evidence',()=>{
 const result={task,suggestions:[{task_quote:'monthly sales reports'}]};assert.equal(taskSuggestionsAreCurrent(result,task),true);
 assert.equal(taskSuggestionsAreCurrent(result,{...task,wording:'Different work'}),false);
 assert.equal(taskSuggestionsAreCurrent({...result,suggestions:[{task_quote:'invented quote'}]},task),false);
 assert.equal(taskSuggestionsAreCurrent({...result,suggestions:Array(4).fill({task_quote:'monthly sales reports'})},task),false);
});
test('suggested activity creates only a sample draft and never workplace evidence automatically',()=>{
 const before=structuredClone(goal);const draft=plannedActivityAttempt(goal,[task],'2026-09-29','draft1');
 assert.equal(draft.date,'2026-09-29');assert.equal(draft.type,'course_practice');assert.equal(draft.task,null);assert.equal(draft.description,goal.action.text);assert.deepEqual(goal,before);assert.equal(goal.attempts.length,0);
});
test('a manually planned study stays study without invented task or course',()=>{
 const study={...goal,action:{kind:'understand',text:'Read a short explanation'}};
 const draft=plannedActivityAttempt(study,[],'2026-09-29','draft2');assert.equal(draft.type,'study');assert.equal(draft.task,null);
});
test('fallback ideas are explicitly general templates and do not modify saved goals',()=>{
 const before=structuredClone(goal);const idea=templateGoalSuggestion(goal);assert.equal(idea.source,'template');assert.match(idea.notice,/not a reviewed practice guide/);assert.equal(idea.goal_id,goal.id);assert.notEqual(templateGoalSuggestion(goal,true).action.text,idea.action.text);assert.deepEqual(goal,before);
});

test('changed or unreadable source context blocks prepared plans while an honest evidence gap remains usable',async()=>{
 const {hasMaterialGoalWarnings}=await import('../src/features/learning-goals/guidedLearning.ts');
 assert.equal(hasMaterialGoalWarnings([]),false);
 assert.equal(hasMaterialGoalWarnings(['No confirmed work task or career reason was saved with this goal.']),false);
 assert.equal(hasMaterialGoalWarnings(['Your work or skill choice has changed.']),true);
 assert.equal(hasMaterialGoalWarnings(['Your saved specialist skills could not be read.']),true);
});
test('a short practice example is retained in the accepted action without truncating longer examples',async()=>{
 const {suggestedActivityText}=await import('../src/features/learning-goals/guidedLearning.ts');
 const idea={action:{kind:'practise',text:'Check a fictional sample'},practice_idea:'Use a made up table with three rows.'};
 assert.match(suggestedActivityText(idea),/Practice example: Use a made up table/);
 assert.equal(suggestedActivityText({...idea,practice_idea:'x'.repeat(1001)}),idea.action.text);
});


test('software testing fallback gives an actionable fictional exercise without claiming ability', () => {
  const testing = { ...goal, initial: { ...goal.initial, skill: { label: 'write automated software tests' } } };
  const before = structuredClone(testing);
  const idea = templateGoalSuggestion(testing);
  assert.match(idea.action.text, /2 \+ 3 returns 5/);
  assert.match(idea.action.text, /0 \+ 0 returns 0/);
  assert.match(idea.action.text, /text such as 'two'/);
  assert.equal(idea.practice_idea, idea.action.text);
  assert.match(idea.goal, /^Practise:/);
  assert.deepEqual(testing, before);
  assert.match(idea.notice, /not a reviewed practice guide/);
});

test('non software skills retain a generic sample instead of an unrelated software exercise', () => {
  const other = { ...goal, initial: { ...goal.initial, skill: { label: 'test mechanical systems' } } };
  const idea = templateGoalSuggestion(other);
  assert.match(idea.action.text, /test mechanical systems/);
  assert.doesNotMatch(idea.action.text, /function|2 \+ 3/);
});
