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
const button = dataUrl(`import {createElement} from ${JSON.stringify(packageUrl('react'))}; export const Button=({children,variant,...props})=>createElement('button',props,children);`);
const imports = {
  '@/components/ui/button': button,
  '@/pages/Analysis/components/TaskDetailsDrawer': dataUrl('export default function Drawer(){return null}'),
  '@/pages/Analysis/lib/taskScore': new URL('../src/pages/Analysis/lib/taskScore.ts', import.meta.url).href,
  '@/pages/Analysis/lib/dataSources': new URL('../src/pages/Analysis/lib/dataSources.ts', import.meta.url).href,
};
async function component(name) {
  const source = readFileSync(new URL(`../src/pages/AIExposure/components/${name}.tsx`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText
    .replace(/from "([^"]+)"/g,(_,id)=>`from ${JSON.stringify(imports[id] ?? packageUrl(id))}`);
  return (await import(dataUrl(js))).default;
}
const Compare = await component('ExposureCompareCard');
const TaskList = await component('ExposureTaskList');
const render = (Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

test('score explanation is optional, plain, and does not present 26 as job-loss probability',()=>{
  const html=render(Compare,{occupationTitle:'Technician',insight:{scoredCount:8,missingCount:0,taskMean:.26,occupationScore:.26},onOpenDetails(){},onViewTasks(){}});
  assert.match(html,/8 of your 8 tasks/);
  assert.match(html,/<details\b/);
  assert.doesNotMatch(html,/<details[^>]*\bopen|<svg|26%/);
  assert.match(html,/26 out of 100/);
  assert.match(html,/not percentages of your job being replaced/);
});
test('missing scores remain unknown while a real zero stays zero',()=>{
  const html=render(Compare,{occupationTitle:'Technician',insight:{scoredCount:1,missingCount:2,taskMean:0,occupationScore:null},onOpenDetails(){},onViewTasks(){}});
  assert.match(html,/0 out of 100/);
  assert.match(html,/Not available/);
  assert.match(html,/2 tasks have no reliable score/);
});
test('task overview starts with three ranked tasks and offers the whole list',()=>{
  const tasks=[.1,.8,null,.4,.6].map((score,i)=>({id:String(i),wording:`Task ${i}`,score2025:score}));
  const html=render(TaskList,{tasks,assessments:[]});
  assert.equal((html.match(/<li /g)??[]).length,3);
  assert.ok(html.indexOf('Task 1') < html.indexOf('Task 4'));
  assert.ok(html.indexOf('Task 4') < html.indexOf('Task 3'));
  assert.match(html,/Show all 5 tasks/);
  assert.doesNotMatch(html,/slider|role="button"/);
});
test('unscored task is visible with an honest label and an accessible details action',()=>{
  const html=render(TaskList,{tasks:[{id:'unknown',wording:'Check a machine',score2025:null}],assessments:[]});
  assert.match(html,/No reliable research score/);
  assert.match(html,/Understand this task: Check a machine/);
  assert.doesNotMatch(html,/0 out of 100/);
});
