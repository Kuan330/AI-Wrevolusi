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
  '@/components/ui/button': dataUrl(`import {createElement} from ${JSON.stringify(packageUrl('react'))}; export const Button=({children,variant,asChild,...props})=>createElement('div',props,children);`),
  'react-router-dom': dataUrl(`import {createElement} from ${JSON.stringify(packageUrl('react'))}; export const Link=({children,to,state,...props})=>createElement('a',{href:to,...props},children);`),
  '@/pages/Analysis/components/TaskDetailsDrawer': dataUrl('export function TaskAssistAccess(){return null}'),
  '@/constants/routes': new URL('../src/constants/routes.ts', import.meta.url).href,
  '@/features/work-profile/taskSourceLabel': new URL('../src/features/work-profile/taskSourceLabel.ts', import.meta.url).href,
  '../lib/taskResearch': new URL('../src/pages/AIExposure/lib/taskResearch.ts', import.meta.url).href,
  '../lib/taskGuidance': new URL('../src/pages/AIExposure/lib/taskGuidance.ts', import.meta.url).href,
  '@/pages/Analysis/lib/dataSources': new URL('../src/pages/Analysis/lib/dataSources.ts', import.meta.url).href,
};
function compiled(name) {
  const source=readFileSync(new URL(`../src/pages/AIExposure/components/${name}.tsx`,import.meta.url),'utf8');
  return dataUrl(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "([^"]+)"/g,(_,id)=>`from ${JSON.stringify(imports[id] ?? packageUrl(id))}`));
}
imports['./TaskImpact']=compiled('TaskImpact');
const Impact=(await import(imports['./TaskImpact'])).default;
const TaskList=(await import(compiled('ExposureTaskList'))).default;
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
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
test('three questions precede collapsed evidence; source value is not an adjusted personal score',()=>{
  const html=render(Impact,{task,assessment,researchChecked:true,researchUnavailable:false});
  assert.match(html,/1\. What could change/);assert.match(html,/2\. What still needs my judgement/);assert.match(html,/3\. What can I do next/);
  const before=html.split('<details')[0];
  assert.doesNotMatch(before,/0\.1375|0\.95|0\.8/);
  assert.match(html,/0\.1375 on a 0–1 scale/);
  assert.doesNotMatch(html,/<details[^>]*\bopen|0\.95|0\.8|13\.75%/);
  assert.match(html,/not a probability of job loss/);
  assert.match(html,/href="\/skills\?task=one"/);
});
test('candidate source values stay hidden and no personal estimate is invented',()=>{
  const html=render(Impact,{task,assessment:{...assessment,match_layer:'llm'},researchChecked:true});
  assert.match(html,/Possible research link/);assert.match(html,/No score is shown while the match is uncertain/);
  assert.doesNotMatch(html,/0\.1375|0\.95|0\.8/);
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
