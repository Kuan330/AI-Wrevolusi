import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let stored, profile, owner, fail, duringCommit;
const source=readFileSync(new URL('../src/features/journey/specialistSkills.ts',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'')+'\nreturn {parseSpecialistState,readSpecialistState,saveSpecialistEntry,saveSpecialistFocus,specialistEntryKey,specialistEntryIsCurrent};';
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/export /g,'');
const api=new Function('accountStorage','commitWorkspaceItems','currentWorkspaceSession','readJourneyProfile',compiled)(
 {getItem:key=>stored.get(key)??null}, async values=>{const initial=owner;if(duringCommit)await duringCommit();if(fail)throw Error('save failed');if(owner!==initial)throw Error('account changed');for(const [k,v]of Object.entries(values))stored.set(k,v);},()=>owner,()=>profile);
const key='aiwrevolusi.specialistSkills.v1';
const uri='http://data.europa.eu/esco/skill/12345678-1234-1234-1234-123456789abc';
const entry=()=>({taskId:'t1',taskWording:'Interpret mechanical drawings',occupationCode:'3115',skillUri:uri,skillLabel:'Interpret drawings',sourceVersion:'v1.2.0',decision:null,wantsLearning:true});
beforeEach(()=>{stored=new Map();profile={tasksConfirmed:true,tasksOccupationCode:'3115',tasks:[{id:'t1',wording:'Interpret mechanical drawings'}]};owner=1;fail=false;duringCommit=null;});
test('learning interest is valid without claiming a skill and can be focused',async()=>{await api.saveSpecialistEntry(entry());const s=api.readSpecialistState();assert.equal(s.entries[0].decision,null);await api.saveSpecialistFocus(api.specialistEntryKey(s.entries[0]));assert.ok(api.readSpecialistState().focusKey);assert.deepEqual([...stored.keys()],[key]);});
test('rejecting current use preserves an independent learning interest',async()=>{await api.saveSpecialistEntry({...entry(),decision:'use'});await api.saveSpecialistFocus(api.specialistEntryKey(entry()));await api.saveSpecialistEntry({...entry(),decision:'no'});assert.equal(api.readSpecialistState().entries[0].decision,'no');assert.ok(api.readSpecialistState().focusKey);});
test('removing interest clears focused skill',async()=>{await api.saveSpecialistEntry(entry());await api.saveSpecialistFocus(api.specialistEntryKey(entry()));await api.saveSpecialistEntry({...entry(),wantsLearning:false});assert.equal(api.readSpecialistState().focusKey,null);await assert.rejects(api.saveSpecialistFocus(api.specialistEntryKey(entry())),/interest/);});
test('failed saves never publish choices as saved',async()=>{fail=true;await assert.rejects(api.saveSpecialistEntry(entry()),/save failed/);assert.equal(stored.has(key),false);});
test('stale or unconfirmed work cannot save new specialist decisions',async()=>{for(const change of [{tasksConfirmed:false},{tasks:[{id:'t1',wording:'Different work'}]},{tasksOccupationCode:'9999'}]){const original=profile;profile={...profile,...change};await assert.rejects(api.saveSpecialistEntry(entry()),/work changed/);profile=original;}});
test('stale choices remain recoverable but cannot be a current learning focus',async()=>{await api.saveSpecialistEntry(entry());profile.tasks[0].wording='New work';assert.equal(api.specialistEntryIsCurrent(api.readSpecialistState().entries[0],profile.tasks,'3115'),false);await assert.rejects(api.saveSpecialistFocus(api.specialistEntryKey(entry())),/work changed/);assert.equal(api.readSpecialistState().entries.length,1);});
test('account switching during save cannot populate another account',async()=>{duringCommit=()=>{owner++;stored=new Map();};await assert.rejects(api.saveSpecialistEntry(entry()),/account changed/);assert.equal(stored.size,0);});
test('malformed saved state is preserved and requires recovery',()=>{stored.set(key,'{');assert.throws(api.readSpecialistState,/could not be read/);assert.equal(stored.get(key),'{');});
test('bad IDs, extra score fields, duplicates and dangling focus are rejected',()=>{const e={...entry(),updatedAt:new Date().toISOString()};for(const bad of [{...e,skillUri:'1'},{...e,abilityScore:90},{...e,decision:'mastered'},{...e,wantsLearning:'yes'}])assert.throws(()=>api.parseSpecialistState(JSON.stringify({version:1,entries:[bad],focusKey:null})));assert.throws(()=>api.parseSpecialistState(JSON.stringify({version:1,entries:[e,e],focusKey:null})));assert.throws(()=>api.parseSpecialistState(JSON.stringify({version:1,entries:[],focusKey:'missing'})));});
test('changing source version requires a fresh learning focus',async()=>{await api.saveSpecialistEntry(entry());await api.saveSpecialistFocus(api.specialistEntryKey(entry()));await api.saveSpecialistEntry({...entry(),sourceVersion:'v1.2.1'});assert.equal(api.readSpecialistState().focusKey,null);});

test('source occupation can be recorded without changing the confirmed occupation',async()=>{
 const sourceOccupationUri='http://data.europa.eu/esco/occupation/12345678-1234-1234-1234-123456789abc';
 await api.saveSpecialistEntry({...entry(),sourceOccupationUri});
 assert.equal(api.readSpecialistState().entries[0].sourceOccupationUri,sourceOccupationUri);
 assert.equal(profile.tasksOccupationCode,'3115');
 await assert.rejects(api.saveSpecialistEntry({...entry(),sourceOccupationUri:'https://untrusted.example/role'}),/could not be read/);
});
test('all-skill discovery can save against a task without a profile occupation',async()=>{
 profile.tasksOccupationCode=null;
 await api.saveSpecialistEntry({...entry(),occupationCode:null,sourceOccupationUri:null});
 await api.saveSpecialistFocus(api.specialistEntryKey(entry()));
 assert.equal(api.readSpecialistState().entries[0].occupationCode,null);
});
