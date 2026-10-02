import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activateWorkspace, accountStorage } from '../src/services/accountStorage.ts';
import { parseLearningGoals, goalContextWarnings, LEARNING_GOALS_KEY } from '../src/features/learning-goals/learningGoals.ts';
import { readPersonalPlans } from '../src/features/learning-goals/personalLearningPlan.ts';
import { LEARNING_ONBOARDING_KEY, parseOnboardingCompletion, onboardingStatus, validateLearningRequest, createOnboardingRecords, completeLearningOnboarding } from '../src/features/learning-onboarding/learningOnboarding.ts';

const memory = new Map();
const originalFetch = globalThis.fetch;
const inputs = { goalText: 'Learn AI for my current job', experience: 'new', minutesPerDay: 30, goalKind: 'career' };
const course = (overrides={}) => ({ id:'course-ai',title:'Introduction to artificial intelligence',skills:['ai-and-big-data'],intro:'Understand artificial intelligence and apply it in your work.',outcomes:[],level:'beginner',provider:'Provider',url:'https://example.com/course',durationMin:45,chapters:[{title:'Getting started',min:45}],format:'online',language:'English',selfPaced:true,register:'not-required',match:{},prereq:'',advice:'',...overrides });
const referenceSkills = [{wef_skill_id:11,core_skill:'AI and big data'}];
const records = (overrides={}) => createOnboardingRecords({ inputs, resources:[], courses:[course()], selectedSkill:'ai-and-big-data', referenceSkills, goalId:'12345678-1234-1234-1234-123456789abc', ...overrides });
const response = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

beforeEach(() => {
  memory.clear();
  globalThis.localStorage = { getItem:key=>memory.get(key)??null, setItem:(key,value)=>memory.set(key,value), removeItem:key=>memory.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  activateWorkspace('onboarding-user',{data:{},revision:0});
});
afterEach(() => { activateWorkspace(null); globalThis.fetch=originalFetch; });

test('first visit stays new until a server-confirmed setup is stored', () => {
  assert.equal(onboardingStatus(),'new');
  records();
  assert.equal(onboardingStatus(),'new');
});
test('natural-language request is required and has a bounded length', () => {
  assert.match(validateLearningRequest('  '),/what you/);
  assert.match(validateLearningRequest('a'.repeat(301)),/300/);
  assert.equal(validateLearningRequest('Learn to communicate clearly'),'');
});
test('completion marker is strict and corrupt data cannot silently reset onboarding', () => {
  assert.equal(parseOnboardingCompletion(null),null);
  for (const raw of ['{','null','[]',JSON.stringify({version:1,completedAt:'invalid',goalId:'g1',planId:'p1'}),JSON.stringify({version:1,completedAt:'2026-10-01T00:00:00Z',goalId:' ',planId:'p1'}),JSON.stringify({version:1,completedAt:'2026-10-01T00:00:00Z',goalId:'g1',planId:'p1',extra:true})]) assert.throws(()=>parseOnboardingCompletion(raw),/could not be read/);
  activateWorkspace('bad',{data:{[LEARNING_ONBOARDING_KEY]:'{'},revision:0});
  assert.throws(()=>onboardingStatus(),/could not be read/);
});
test('free goals preserve the user request without claiming confirmed skills or tasks', () => {
  const {goal,plan}=records();
  assert.equal(goal.wording,inputs.goalText);
  assert.equal(goal.sourceKey,`onboarding:${goal.id}`);
  assert.equal(goal.initial.origin,'browse');
  assert.equal(goal.initial.skill.source,'personal');
  assert.equal(goal.initial.decision,null);
  assert.deepEqual(goal.initial.tasks,[]);
  assert.equal(goal.initial.career,null);
  assert.equal(plan.goalId,goal.id);
  assert.deepEqual(goalContextWarnings(goal),[]);
  assert.deepEqual(parseLearningGoals(JSON.stringify({version:1,goals:[goal]})),[goal]);
});
test('course recommendations require an explicit current skill, not a keyword guess', () => {
  const selected=records();
  assert.equal(selected.plan.skillId,'ai-and-big-data');
  assert.deepEqual(selected.plan.courseIds,['course-ai']);
  const independent=records({selectedSkill:null});
  assert.deepEqual(independent.plan.courseIds,[]);
  assert.equal(independent.plan.skillId,'');
  assert.equal(independent.plan.activities[0].kind,'practice');
  assert.throws(()=>records({selectedSkill:'unknown-skill'}),/current WEF framework/);
  assert.equal(records({selectedSkill:11}).plan.skillId,'ai-and-big-data');
});
test('setup commit atomically saves goal, plan and marker, then hides the first-use screen', async () => {
  const result=records(); let payload;
  globalThis.fetch=async (_url,init) => { payload=JSON.parse(init.body); return response({data:payload.data,revision:1}); };
  await completeLearningOnboarding(result);
  assert.ok(payload.data[LEARNING_ONBOARDING_KEY]);
  assert.ok(payload.data[LEARNING_GOALS_KEY]);
  assert.ok(payload.data['aiwrevolusi.learningPlanDraft.v1']);
  assert.equal(onboardingStatus(),'completed');
  assert.equal(readPersonalPlans()[0].id,result.plan.id);
  // Simulate another visit/device restoring only confirmed account data.
  activateWorkspace('onboarding-user',{data:payload.data,revision:1});
  assert.equal(onboardingStatus(),'completed');
});
test('server failure never publishes completion or loses existing account records', async () => {
  const originalGoal=records({goalId:'22345678-1234-1234-1234-123456789abc'}).goal;
  const existingRaw=JSON.stringify({version:1,goals:[originalGoal]});
  activateWorkspace('failed-user',{data:{[LEARNING_GOALS_KEY]:existingRaw},revision:0});
  globalThis.fetch=async()=>response({detail:'Could not save'},500);
  await assert.rejects(completeLearningOnboarding(records()));
  assert.equal(onboardingStatus(),'new');
  assert.equal(accountStorage.getItem(LEARNING_ONBOARDING_KEY),null);
  assert.equal(accountStorage.getItem(LEARNING_GOALS_KEY),existingRaw);
  assert.equal(readPersonalPlans().length,0);
});
test('an in-flight save leaves the screen incomplete until server acknowledgement', async () => {
  let resolve;
  globalThis.fetch=()=>new Promise(done=>{resolve=done;});
  const result=records();
  const pending=completeLearningOnboarding(result);
  await new Promise(done=>setImmediate(done));
  assert.equal(onboardingStatus(),'new');
  resolve(response({data:{},revision:1}));
  await pending;
  assert.equal(onboardingStatus(),'completed');
});
test('switching accounts cannot carry completion or publish the old pending save', async () => {
  let resolve;
  globalThis.fetch=()=>new Promise(done=>{resolve=done;});
  const pending=completeLearningOnboarding(records());
  await new Promise(done=>setImmediate(done));
  activateWorkspace('different-user',{data:{},revision:0});
  resolve(response({data:{},revision:1}));
  await assert.rejects(pending,/account changed/);
  assert.equal(onboardingStatus(),'new');
});
test('existing generated plans bypass onboarding, but ordinary saved goals alone do not', () => {
  const result=records();
  activateWorkspace('legacy',{data:{'aiwrevolusi.learningPlanDraft.v1':JSON.stringify(result.plan)},revision:0});
  assert.equal(onboardingStatus(),'completed');
  activateWorkspace('goal-only',{data:{[LEARNING_GOALS_KEY]:JSON.stringify({version:1,goals:[result.goal]})},revision:0});
  assert.equal(onboardingStatus(),'new');
});
test('dangling completion references are reported rather than overwriting saved work', () => {
  const result=records();
  activateWorkspace('dangling',{data:{[LEARNING_ONBOARDING_KEY]:JSON.stringify(result.completion)},revision:0});
  assert.throws(()=>onboardingStatus(),/missing its goal or plan/);
});
test('entry wraps the existing page instead of changing Goals & activities or My courses', () => {
  const routes=readFileSync(new URL('../src/routes/index.tsx',import.meta.url),'utf8');
  assert.match(routes,/<LearningPlanOnboarding><LearningGoals \/><\/LearningPlanOnboarding>/);
  assert.match(routes,/<AccountGate kind="plan"><Plan \/><\/AccountGate>/);
  const page=readFileSync(new URL('../src/pages/LearningPlanOnboarding/LearningPlanOnboarding.tsx',import.meta.url),'utf8');
  assert.match(page,/if \(complete\) return <>{children}<\/>/);
  assert.match(page,/owner !== currentWorkspaceSession\(\)/);
});
