import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { activateWorkspace, accountStorage } from '../src/services/accountStorage.ts';
import { saveConfirmedAnalysis, writeUserProfile, readUserProfile, saveProfileTasks, confirmProfileTasks } from '../src/features/work-profile/userProfile.ts';
import { readJourneyState, parseJourneyState, currentWorkKey, saveSkillDecision, completeSkillReview, startLearning, readLearningContext, learningContextNeedsReview, getContinueDestination, safeJourneyDestination, journeyForAddedCourse, getCourseContext, rememberCourse, rememberIntent } from '../src/features/journey/journey.ts';
import { savePlanState } from '../src/features/learning-planning/planCourses.ts';
import { changeSavedCourses } from '../src/features/learning-planning/courseOperations.ts';
import { resetCourseDirectory } from '../src/features/learning-planning/courseDirectory.ts';

const memory = new Map();
const key='aiwrevolusi.journey.v1';
const profileKey='aiwrevolusi.userProfile';
const planKey='aiwrevolusi.plan.courses.v1';
let writes=[];
function response(body) { return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}}); }
function analysis() { return { occupationCode:'4110',occupationTitle:'Office clerk',occupationPath:[],potential25:null,meanScore2025:null,tasks:[{id:'task-1',wording:'Analyse sales data and prepare reports',practice:{trials:[]}}],taskExposureAssessments:[] }; }
function skill() { return {id:1,slug:'analytical-thinking',name:'Analytical thinking'}; }
function plan(courses) { return {version:1,courses,records:{}}; }
function course(id='course-1', value=0) { return {id,title:'Checking a report',provider:'Fixture',skillId:'analytical-thinking',chapters:[{title:'Check sources',value}]}; }
function catalogue() { return {found:true,courses:[{course_id:'course-1',title:'Checking a report',provider:'Fixture',skill_id:'analytical-thinking',chapters:[{title:'Check sources',duration_min:15}]}]}; }
const startWork = () => startLearning({origin:'work',skill:skill(),taskIds:['task-1'],taskLabels:[analysis().tasks[0].wording],goal:'Check report conclusions'});

beforeEach(()=>{
  activateWorkspace(null);memory.clear();writes=[];resetCourseDirectory();
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{writes.push(k);memory.set(k,v)},removeItem:k=>{writes.push(k);memory.delete(k)}};
  globalThis.sessionStorage={getItem:()=>null};
  globalThis.window=new EventTarget();
  globalThis.fetch=async(_url,init)=>init?.method==='PATCH' ? response({revision:1,data:JSON.parse(init.body).data}) : response(catalogue());
});
afterEach(()=>activateWorkspace(null));

test('new accounts start with work, evidence gaps continue to skills, reads do not write',()=>{
  assert.equal(getContinueDestination(),'/profile');
  saveConfirmedAnalysis(analysis()); writes=[];
  assert.equal(getContinueDestination(),'/skills');
  assert.ok(currentWorkKey().includes('task-1'));
  assert.deepEqual(writes,[]);
});

test('starter drafts are not confirmed; explicit confirmation survives an evidence outage and edits clear it',()=>{
  saveProfileTasks('4110',analysis().tasks);
  assert.equal(readUserProfile().tasksConfirmed,false);
  confirmProfileTasks();
  assert.equal(readUserProfile().tasksConfirmed,true);
  assert.equal(readUserProfile().analysis,null);
  writeUserProfile({tasks:[{id:'task-1',wording:'Review new customer records'}]});
  assert.equal(readUserProfile().tasksConfirmed,false);
});

test('confirmed work continues to skills when the ILO assessment has not completed',async()=>{
  saveProfileTasks('4110',analysis().tasks);
  assert.equal(getContinueDestination(),'/profile/tasks');
  await rememberIntent('work');
  confirmProfileTasks();
  assert.equal(readUserProfile().analysis,null);
  assert.equal(getContinueDestination(),'/skills');
  memory.delete(key);
  assert.equal(getContinueDestination(),'/skills');
});

test('unconfirmed tasks cannot be accepted as current skills',async()=>{
  saveProfileTasks('4110',analysis().tasks);
  await assert.rejects(saveSkillDecision(1,'accepted'),/Confirm your work/);
});

test('invalid journey and work records are preserved instead of treated as an empty account',()=>{
  memory.set(key,'{"version":5}');assert.throws(readJourneyState,/could not be read/);assert.equal(memory.get(key),'{"version":5}');
  memory.delete(key);memory.set('aiwrevolusi.confirmedAnalysis',JSON.stringify({occupationTitle:'Clerk',tasks:[{}]}));
  assert.throws(getContinueDestination,/saved work could not be read/);
  assert.equal(memory.has('aiwrevolusi.confirmedAnalysis'),true);
});

test('independent catalogue browsing never needs matching work evidence',async()=>{
  saveConfirmedAnalysis(analysis());
  const url=await startLearning({origin:'browse',skill:skill()});
  const context=readLearningContext(new URL(url,'https://local').searchParams.get('context'));
  writeUserProfile({tasks:[] ,analysis:null});
  assert.equal(learningContextNeedsReview(context),false);
});

test('accepted work skill and goal survive refresh and preserve exact task context',async()=>{
  saveConfirmedAnalysis(analysis());
  await saveSkillDecision(1,'accepted');await completeSkillReview();
  const url=await startWork();
  const id=new URL(url,'https://local').searchParams.get('context');
  const context=readLearningContext(id);
  assert.equal(context.goal,'Check report conclusions');assert.deepEqual(context.taskIds,['task-1']);
  assert.equal(context.skill.source,'wef');assert.equal(learningContextNeedsReview(context),false);
  assert.equal(parseJourneyState(memory.get(key)).contexts[id].id,id);
  assert.equal(getContinueDestination(),url);
});

test('undoing acceptance invalidates its work recommendation; wanted career learning is still allowed',async()=>{
  saveConfirmedAnalysis(analysis());await saveSkillDecision(1,'accepted');await completeSkillReview();await startWork();
  const context=readLearningContext();await saveSkillDecision(1,undefined);
  assert.equal(learningContextNeedsReview(context),true);
  assert.throws(()=>journeyForAddedCourse('course-1',context.id),/Review/);
  await saveSkillDecision(1,'rejected');
  const url=await startLearning({origin:'career',skill:skill(),career:{code:'2421',title:'Business analyst'},goal:'Explore analysis'});
  assert.equal(readLearningContext(new URL(url,'https://local').searchParams.get('context')).origin,'career');
});

test('a changed task needs a new review without erasing saved courses or old context',async()=>{
  saveConfirmedAnalysis(analysis());savePlanState(plan([course()]));
  await saveSkillDecision(1,'accepted');await saveSkillDecision(2,'rejected');await completeSkillReview();await startWork();
  const context=readLearningContext();const oldPlan=memory.get(planKey);
  writeUserProfile({tasks:[{...analysis().tasks[0],wording:'Review client records'}],analysis:null});
  assert.equal(learningContextNeedsReview(context),true);assert.equal(memory.get(planKey),oldPlan);
  confirmProfileTasks();await saveSkillDecision(3,'accepted');
  assert.deepEqual(readJourneyState().review.decisions,{'2':'rejected','3':'accepted'});
  assert.equal(readLearningContext(context.id).taskLabels[0],analysis().tasks[0].wording);
});

test('course, plan and recommendation origin are committed together',async()=>{
  saveConfirmedAnalysis(analysis());await saveSkillDecision(1,'accepted');await completeSkillReview();await startWork();
  const context=readLearningContext();
  await changeSavedCourses({add:['course-1'],learningContextId:context.id});
  assert.equal(getCourseContext('course-1').id,context.id);
  assert.equal(JSON.parse(memory.get(planKey)).courses[0].id,'course-1');
  assert.equal(getContinueDestination(),'/plan?course=course-1');
});

test('unsupported course-skill link does not save a course or replace the learning goal',async()=>{
  saveConfirmedAnalysis(analysis());await startLearning({origin:'browse',skill:{id:2,slug:'leadership-and-social-influence',name:'Leadership and social influence'}});
  const context=readLearningContext();const previous=memory.get(key);
  await assert.rejects(changeSavedCourses({add:['course-1'],learningContextId:context.id}),/no supported link/);
  assert.equal(memory.get(key),previous);assert.equal(memory.has(planKey),false);
});

test('two active courses do not default to an arbitrary first course; explicit course wins',async()=>{
  saveConfirmedAnalysis(analysis());savePlanState(plan([course('a'),course('b')]));
  assert.equal(getContinueDestination(),'/plan');
  await rememberCourse('b');assert.equal(getContinueDestination(),'/plan?course=b');
});

test('a work edit does not prevent returning to an active saved course',()=>{
  savePlanState(plan([course()]));
  memory.set(profileKey,JSON.stringify({tasks:[],tasksOccupationCode:null,analysis:null,learningReviewNeeded:true}));
  assert.equal(getContinueDestination(),'/plan?course=course-1');
});

test('completed courses lead to the learning overview, not forced reassessment',()=>{
  saveConfirmedAnalysis(analysis());savePlanState(plan([course('course-1',10)]));
  assert.equal(getContinueDestination(),'/plan');
});

test('lookup never treats inherited object properties as a saved context',()=>{
  assert.equal(readLearningContext('constructor'),null);
  assert.equal(getCourseContext('constructor'),null);
});

test('only known internal deep links survive login, with their query and anchor',()=>{
  assert.equal(safeJourneyDestination('/learning-centre?context=abc&skill=writing#courses'),'/learning-centre?context=abc&skill=writing#courses');
  for(const value of ['https://example.com','//example.com','/\\example.com','/unknown','/continue','/','/plan\n'])assert.equal(safeJourneyDestination(value),null);
});

test('failed sync keeps pending context and a late acknowledgement cannot navigate another account',async()=>{
  activateWorkspace('a',{data:{},revision:0});
  let finish;
  globalThis.fetch=()=>new Promise(resolve=>{finish=resolve});
  const pending=startLearning({origin:'browse',skill:skill()});
  assert.ok(accountStorage.getItem(key));
  activateWorkspace('b',{data:{},revision:0});finish(response({revision:1}));
  await assert.rejects(pending,/account changed/);assert.equal(accountStorage.getItem(key),null);
});

test('malformed nested context and dangling links are rejected',()=>{
  for(const state of [
    {version:1,contexts:{bad:{}},courseContexts:{}},
    {version:1,contexts:{},courseContexts:{c:'missing'}},
    {version:1,contexts:{},courseContexts:{},activeContextId:'missing'},
    {version:1,contexts:{},courseContexts:{},review:{workKey:'x',decisions:{1:'mastered'},completed:true,updatedAt:new Date().toISOString()}},
  ])assert.throws(()=>parseJourneyState(JSON.stringify(state)),/could not be read/);
});


test('array enum impostors and null optional records are rejected', async()=>{
  saveConfirmedAnalysis(analysis()); await startLearning({origin:'browse',skill:skill()});
  const valid=readJourneyState(); const id=valid.activeContextId;
  for (const mutate of [
    value=>{value.contexts[id].origin=['browse']},
    value=>{value.contexts[id].career=null},
    value=>{value.review=null},
    value=>{value.resume=null},
    value=>{value.resume.kind=['learning']},
    value=>{value.review={workKey:currentWorkKey(),decisions:{1:['accepted']},completed:true,updatedAt:new Date().toISOString()}},
  ]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>parseJourneyState(JSON.stringify(bad)),/could not be read/)}
});
