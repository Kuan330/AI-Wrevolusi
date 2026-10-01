import assert from 'node:assert/strict';
import test from 'node:test';
import { currentAssessments, assistanceOverview } from '../src/features/ai-impact/assistance.ts';
import { learningActivities, learningSummary, activityDays, coursePercent, courseStatus } from '../src/features/dashboard/learningSummary.ts';
import { recommendSkills } from '../src/features/skills/recommendations.ts';

const task=(id,wording='Analyse sales data')=>({id,wording,iloTaskId:`source-${id}`,source:'ilo'});
const evidence=(t,score,layer='exact')=>({task_id:t.id,match_layer:layer,missing_data_status:'complete',matched_reference_tasks:[{ilo_task_id:t.iloTaskId,task_text:t.wording,score_2025:score}],baseline_score:.9,adjusted_score:.95});
test('overview groups linked evidence and keeps candidate, missing and stale matches unverified',()=>{
  const tasks=Array.from({length:6},(_,i)=>task(String(i)));
  const values=[0,.25,.55,.8];
  const assessments=values.map((value,i)=>evidence(tasks[i],value));
  assessments.push(evidence(tasks[4],1,'llm'));
  const result=assistanceOverview(tasks,assessments);
  assert.deepEqual(result.groups.map(g=>g.count),[2,1,1]);
  assert.equal(result.groups[0].category,'high');
  assert.equal(result.unverified,2);
  assert.equal(result.items[0].score,0);
  assert.equal(result.items[4].score,null);
  const profile={tasks,tasksConfirmed:true,analysis:{classificationCheck:'same-title-v1',tasks:tasks.map(t=>({...t})),taskExposureAssessments:assessments}};
  assert.equal(currentAssessments(profile).length,5);
  profile.tasks=[{...tasks[0],wording:'Changed task'},...tasks.slice(1)];
  assert.equal(currentAssessments(profile).length,4);
  profile.tasksConfirmed=false;
  assert.deepEqual(currentAssessments(profile),[]);
});
test('recommendations prioritise high exposure evidence without inventing skills or overriding rejections',()=>{
  const a=task('a','Programming software'),b=task('b','Analyse sales data'),c=task('c','Analyse data');
  const skills=[{wef_skill_id:1,core_skill:'Analytical thinking'},{wef_skill_id:23,core_skill:'Programming'}];
  const ranked=recommendSkills([a,b,c],skills,[evidence(a,.8),evidence(b,.1),evidence(c,.1)]);
  assert.equal(ranked[0].skill.wef_skill_id,23);
  assert.deepEqual(recommendSkills([a,b,c],skills,[evidence(a,.8)],{'23':'rejected'}).map(i=>i.skill.wef_skill_id),[1]);
  assert.deepEqual(recommendSkills([],skills,[]),[]);
});
test('learning progress is chapter weighted and course completion requires every chapter',()=>{
  const done={id:'done',chapters:[{title:'A',value:10}]};
  const active={id:'active',chapters:[{title:'B',value:5},{title:'C',value:0},{title:'D',value:0}]};
  const empty={id:'empty',chapters:[]};
  const summary=learningSummary({courses:[done,active,empty],records:{}},[],'active');
  assert.equal(summary.percent,38);
  assert.equal(summary.completedChapters,1);
  assert.equal(summary.completedCourses,1);
  assert.equal(summary.nextCourse.id,'active');
  assert.equal(summary.nextChapter.title,'B');
  assert.equal(coursePercent(active),17);
  assert.equal(courseStatus(empty),'planned');
  assert.equal(courseStatus(done),'completed');
});
test('activity timeline includes learning attempts and retained chapter records even after course removal',()=>{
  const plan={courses:[],records:{'2026-09-30':{studied:true,checked:true,minutes:0,note:'',entries:[{courseId:'removed',courseTitle:'Earlier course',chapterTitle:'Practice',percent:100}]}}};
  const goals=[{id:'goal',wording:'Learn analysis',attempts:[{id:'a',date:'2026-10-01',type:'workplace_practice',description:'Checked a report'}]}];
  const activities=learningActivities(plan,goals);
  assert.equal(activities.length,3);
  assert.equal(activities[0].goalId,'goal');
  assert.ok(activities.some(a=>a.courseId==='removed'));
  const days=activityDays(activities,'2026-10-01');
  assert.equal(days.length,84);
  assert.equal(days.at(-1).count,1);
  assert.equal(days.at(-2).count,2);
  assert.equal(activityDays([],'2026-01-01').at(-1).date,'2026-01-01');
});

test('annual activity calendar preserves dates and counts across the year boundary', () => {
  const activities = [{ id:'a', date:'2025-12-31', label:'Study', detail:'', kind:'study' }, { id:'b', date:'2025-12-31', label:'Practice', detail:'', kind:'practice' }];
  const days = activityDays(activities, '2026-01-01', 52);
  assert.equal(days.length,364);
  assert.equal(new Set(days.map(day=>day.date)).size,364);
  assert.equal(days.at(-1).date,'2026-01-01');
  assert.equal(days.at(-2).count,2);
  assert.equal(days.filter(day=>day.count>0).length,1);
});
