import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const dataUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const packageUrl = name => pathToFileURL(require.resolve(name)).href;
const imports = {
  '@/components/ui/card': dataUrl(`import {createElement} from ${JSON.stringify(packageUrl('react'))}; export const Card=({children,...props})=>createElement('div',props,children);`),
  '@/components/ui/tooltip': dataUrl(`export const Tooltip=({children})=>children;`),
  '@/components/ui/button': dataUrl(`import {createElement} from ${JSON.stringify(packageUrl('react'))}; export const Button=({children,variant,asChild,...props})=>createElement('div',props,children);`),
  'react-router-dom': dataUrl(`import {createElement} from ${JSON.stringify(packageUrl('react'))}; export const useSearchParams=()=>[new URLSearchParams(),()=>{}]; export const links=[]; export const Link=({children,to,state,...props})=>{links.push({to,state});return createElement('a',{href:to,...props},children)};`),
  '@/pages/Analysis/components/TaskDetailsDrawer': dataUrl('export function TaskAssistAccess(){return null}'),
  '@/constants/routes': new URL('../src/constants/routes.ts', import.meta.url).href,
  '@/features/work-profile/taskSourceLabel': new URL('../src/features/work-profile/taskSourceLabel.ts', import.meta.url).href,
  '../../../features/ai-impact/taskResearch.ts': new URL('../src/features/ai-impact/taskResearch.ts', import.meta.url).href,
  '../lib/taskGuidance': new URL('../src/pages/AIExposure/lib/taskGuidance.ts', import.meta.url).href,
  '@/pages/Analysis/lib/dataSources': new URL('../src/pages/Analysis/lib/dataSources.ts', import.meta.url).href,
  '@/features/ai-impact/assistance': new URL('../src/features/ai-impact/assistance.ts', import.meta.url).href,
  '@/lib/displayText': new URL('../src/lib/displayText.ts', import.meta.url).href,
};
function compiled(name) {
  const source=readFileSync(new URL(name === 'AssistanceChart' ? '../src/components/dashboard/AssistanceChart.tsx' : `../src/pages/AIExposure/components/${name}.tsx`,import.meta.url),'utf8');
  return dataUrl(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "([^"]+)"/g,(_,id)=>`from ${JSON.stringify(imports[id] ?? packageUrl(id))}`));
}
imports['./TaskImpact']=compiled('TaskImpact');
const Impact=(await import(imports['./TaskImpact'])).default;
const TaskList=(await import(compiled('ExposureTaskList'))).default;
const Coverage=(await import(compiled('AssistanceChart'))).default;
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
const { links } = await import(imports['react-router-dom']);
const task={id:'one',wording:'Check a machine',source:'ilo',originalWording:'Check a machine',iloTaskId:'6',score2025:.9};
const assessment={task_id:'one',match_layer:'exact',missing_data_status:'complete',source_year:'2025',matched_reference_tasks:[{ilo_task_id:'6',task_text:task.wording,score_2025:.1375,source_method:'predicted'}],adjusted_score:.95,baseline_score:.8};
test('first task follows confirmed order; all tasks are available without score ranking',()=>{
  const tasks=[task,{...task,id:'two',wording:'Second task',score2025:1},{...task,id:'three',wording:'Third task'}];
  const html=render(TaskList,{tasks,assessments:[assessment]});
  assert.equal((html.match(/aria-pressed=/g)??[]).length,3);
  assert.ok(html.indexOf('Check a machine')<html.indexOf('Second task'));
  assert.match(html,/label for="impact-task"/);
  assert.doesNotMatch(html,/Highest|Research score:|slider/);
});
test('advice is visible while the published scale and evidence stay collapsed',()=>{
  const html=render(Impact,{task,assessment,researchChecked:true,researchUnavailable:false});
  assert.match(html,/AI can assist with/);assert.match(html,/Your judgement matters/);
  const before=html.split('<details')[0];
  assert.doesNotMatch(before,/<meter/);
  assert.match(html,/<meter[^>]+value="0\.1375"/);
  assert.doesNotMatch(before,/0\.95|0\.8/);
  assert.match(html,/0\.1375 on a 0–1 scale/);
  assert.doesNotMatch(html,/<details[^>]*\bopen|0\.95|0\.8|13\.75%/);
  assert.match(html,/not a probability of job loss/);
  assert.match(html,/href="\/learning\/skills\?view=task&amp;task=one"/);
});
test('task handoff opens skill review directly with the exact task identity and saved wording',()=>{
  const selected={...task,id:'task /?&',wording:'Check a machine\nwith the approved safety procedure'};
  render(Impact,{task:selected,researchChecked:true,researchUnavailable:false});
  const handoff=links.findLast(link=>link.to.startsWith('/learning/skills?'));
  const destination=new URL(handoff.to,'https://example.test');
  assert.equal(destination.pathname,'/learning/skills');
  assert.equal(destination.searchParams.get('view'),'task');
  assert.equal(destination.searchParams.get('task'),selected.id);
  assert.deepEqual(handoff.state,{taskWording:selected.wording});
});
test('candidate source values stay hidden and no personal estimate is invented',()=>{
  const html=render(Impact,{task,assessment:{...assessment,match_layer:'llm'},researchChecked:true});
  assert.match(html,/Unverified/);assert.match(html,/No score is shown while the match is uncertain/);
  assert.doesNotMatch(html,/0\.1375|0\.95|0\.8/);
});

test('assistance chart keeps candidate and missing evidence unverified',()=>{
  const html=render(Coverage,{tasks:[task,{...task,id:'two'},{...task,id:'three'}],assessments:[assessment,{...assessment,task_id:'two',match_layer:'nlp'}]});
  for(const label of ['Human-led','Partially AI-assisted','Highly AI-assisted','Unverified']) assert.ok(html.includes(label));
  assert.match(html, /<strong>2<\/strong> Unverified/);
  assert.doesNotMatch(html,/0\.1375|0\.95|<meter|job loss score/);
});
test('chart keeps every task visible as Unverified before research is checked',()=>{
  const tasks=[task,{...task,id:'two'},{...task,id:'three'}];
  const html=render(Coverage,{tasks,assessments:[],showUnverifiedBar:true});
  assert.equal((html.match(/assistance-chart-row/g)??[]).length,4);
  assert.match(html, /Unverified<\/dt><dd><span[^>]*><span class="assistance-fill assistance-unverified-fill" style="width:100%"/);
  assert.match(html, /<strong>3<span class="sr-only"> tasks<\/span><\/strong>/);
  for(const label of ['Highly AI-assisted','Partially AI-assisted','Human-led']) assert.ok(html.includes(label));
});
test('four bar widths reflect the current task distribution',()=>{
  const tasks=[task,{...task,id:'partial'},{...task,id:'unverified-1'},{...task,id:'unverified-2'}];
  const partial={...assessment,task_id:'partial',matched_reference_tasks:[{...assessment.matched_reference_tasks[0],score_2025:.3375}]};
  const html=render(Coverage,{tasks,assessments:[assessment,partial],showUnverifiedBar:true});
  assert.match(html,/assistance-human" style="width:25%"/);
  assert.match(html,/assistance-partial" style="width:25%"/);
  assert.match(html,/assistance-unverified-fill" style="width:50%"/);
});
test('task-row category agrees with the matching chart category',()=>{
  const taskHtml=render(TaskList,{tasks:[task],assessments:[assessment]});
  const chartHtml=render(Coverage,{tasks:[task],assessments:[assessment]});
  assert.match(taskHtml,/Human-led/);
  assert.match(chartHtml,/Human-led/);
});
test('task chooser keeps every task as an accessible row when the list grows',()=>{
  const tasks=Array.from({length:8},(_,index)=>({...task,id:`task-${index}`,wording:`Task number ${index + 1}`}));
  const html=render(TaskList,{tasks,assessments:[]});
  assert.equal((html.match(/aria-pressed=/g)??[]).length,8);
  assert.match(html,/Task number 8/);
});
test('a real source zero is retained while missing and unchecked research stay unknown',()=>{
  const zero={...assessment,matched_reference_tasks:[{...assessment.matched_reference_tasks[0],score_2025:0}]};
  assert.match(render(Impact,{task,assessment:zero,researchChecked:true}),/0 on a 0–1 scale/);
  for(const props of [{},{assessment:{...assessment,match_layer:'insufficient_data'}},{assessment,researchChecked:false},{assessment,researchUnavailable:true}]) {
    const html=render(Impact,{task,researchChecked:true,...props});
    assert.doesNotMatch(html,/0\.1375|0 on a 0–1 scale/);
    assert.match(html,/Explore skills for this task/);
  }
});

test('interactive donut exposes category buttons and matching active segments',()=>{
  const html=render(Coverage,{tasks:[task],assessments:[assessment],showUnverifiedBar:true,selectedCategory:'human',onCategoryChange:()=>{}});
  assert.equal((html.match(/<button /g)??[]).length,4);
  assert.equal((html.match(/class="assistance-donut-segment"/g)??[]).length,1);
  assert.equal((html.match(/aria-pressed="true"/g)??[]).length,2);
  assert.match(html,/filter-human/);
});
test('category filter excludes unrelated tasks and handles an empty category',()=>{
  const unknown={...task,id:'unknown',wording:'Unknown work task'};
  const html=render(TaskList,{tasks:[task,unknown],assessments:[assessment],category:'unverified',sortByExposure:true});
  assert.match(html,/Unknown work task/);
  assert.equal((html.match(/aria-pressed=/g)??[]).length,1);
  assert.match(render(TaskList,{tasks:[task],assessments:[assessment],category:'high'}),/No tasks in this category/);
});
