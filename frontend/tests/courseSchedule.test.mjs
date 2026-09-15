import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const url = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64');
const model = url(readFileSync('src/pages/Plan/planModel.ts','utf8'));
const source = readFileSync('src/pages/Plan/scheduleCourses.ts','utf8').replace("'./planModel'", JSON.stringify(model));
const { scheduleCourses } = await import(url(source));
const course = { id:'c1', title:'Course', minutes:75 };
const selection = { resourceId:'c1', weekdays:[0,1,2,3,4,5,6], startTime:'18:00', endTime:'18:30' };
test('before starting time imports from today and splits final session', () => {
 const {events}=scheduleCourses([selection],[course],[],new Date('2026-09-10T17:00:00'));
 assert.equal(events.length,3); assert.equal(events[0].date,'2026-09-10'); assert.equal(events[2].end,'18:15');
});
test('elapsed start, including an ongoing time window, begins tomorrow', () => {
 for(const time of ['18:01','18:30','23:59']) assert.equal(scheduleCourses([selection],[course],[],new Date(`2026-09-10T${time}:00`)).events[0].date,'2026-09-11');
});
test('respects weekdays and skips occupied days', () => {
 const occupied={id:'work',date:'2026-09-11',start:'17:00',end:'19:00'};
 const result=scheduleCourses([{...selection,weekdays:[4]}],[course],[occupied],new Date('2026-09-10T19:00:00'));
 assert.equal(result.events[0].date,'2026-09-18');
});
test('import again does not duplicate sessions', () => {
 const first=scheduleCourses([selection],[course],[],new Date('2026-09-10T17:00:00'));
 assert.equal(scheduleCourses([selection],[course],first.events,new Date('2026-09-10T17:00:00')).events.length,0);
});
test('unknown duration and invalid windows are not guessed', () => {
 assert.equal(scheduleCourses([{...selection,totalMinutes:null}],[course],[]).events.length,0);
 assert.equal(scheduleCourses([{...selection,endTime:'17:00'}],[course],[]).issues.length,1);
});
test('multiple courses never overlap and selected duration overrides course total', () => {
 const result=scheduleCourses([{...selection,totalMinutes:15},{...selection,resourceId:'c2'}],[course,{...course,id:'c2'}],[],new Date('2026-09-10T17:00:00'));
 assert.equal(result.events[0].end,'18:15'); assert.equal(result.events[1].date,'2026-09-11');
});
