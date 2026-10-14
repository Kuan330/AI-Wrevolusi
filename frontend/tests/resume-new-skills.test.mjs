import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeLearningCourses, reviewedCourseSkills } from '../src/features/resume/courseSkills.ts';
import { mergeSkillInputs } from '../src/features/resume/skills.ts';
import { explicitResumeSkills } from '../src/features/resume/sourceSkills.ts';
import { emptyDraft } from '../src/features/resume/types.ts';
import { parseResumeRecord } from '../src/features/resume/repository.ts';
import { composeCareerInput } from '../src/features/resume/learningRecords.ts';
import { validRoleAlignment, appliedCareerAlignment } from '../src/features/resume/careerAlignment.ts';
import { applyAssistantProposal } from '../src/features/resume/assistant.ts';
import { createEditorHistory } from '../src/features/resume/editorHistory.ts';
import { api } from '../src/services/api.ts';
import { resumeService } from '../src/features/resume/service.ts';
const course = (id='WEF-10-A-01')=>({id,title:'Marketing communications as a strategic function',skills:['service-orientation-and-customer-service'],provider:'OpenLearn',catalogueChaptersComplete:true,chapters:Array.from({length:4},(_,i)=>({title:'Section '+i})),outcomes:['Analyse marketing communications strategically'],teachingObjectives:'Analyse marketing communications strategically',sourceFingerprint:'source:'+id});
const review = (id='WEF-10-A-01')=>({course_id:id,title:course(id).title,source_fingerprint:course(id).sourceFingerprint,outcomes:course(id).teachingObjectives,reviewed:true,notices:[],skills:[{name:'Strategic marketing communications',quote:course(id).teachingObjectives,selected:true}]});
const rows = (value=10)=>Array.from({length:4},(_,chapter_index)=>({course_id:course().id,skill_id:'service-orientation-and-customer-service',chapter_index,value}));
test('insurance Core Skills keeps all 15 original skill names before role selection',()=>{
 const names=explicitResumeSkills('Core Skills\n• Sales & Advisory: Needs analysis, cross-selling, policy renewals, lead generation\n• Product Knowledge: Life, medical, motor, property, and travel insurance\n• Compliance: Underwriting guidelines, KYC/AML, claims documentation\n• Soft Skills: Negotiation, active listening, client retention, objection handling\n• Tools: Salesforce, Microsoft Office, CRM system');
 assert.equal(names.length,15);assert.ok(names.includes('Negotiation'));assert.ok(names.includes('Life, medical, motor, property, and travel insurance'));
});
test('selected, pending and progress-only courses keep distinct IDs and synchronised status',()=>{
 const a=course(),b=course('WEF-20-A-02'),english={...course('WEF-21-B-01'),chapters:course().chapters.slice(0,3),skills:['reading-writing-and-mathematics']};
 const directory=new Map([a,b,english].map(row=>[row.id,row]));
 const input=[...rows(),...rows().slice(0,2).map(row=>({...row,course_id:english.id,skill_id:english.skills[0]}))];
 const result=resumeLearningCourses(directory,[a.id,b.id],input);
 assert.deepEqual(result.map(row=>[row.course.id,row.status]),[[a.id,'completed'],[b.id,'planned'],[english.id,'in_progress']]);
 assert.equal(resumeLearningCourses(directory,[a.id],null)[0].status,'unavailable');
});
test('only selected and confirmed curriculum names become candidates; objectives do not become personal evidence',()=>{
 const courses=resumeLearningCourses(new Map([[course().id,course()]]),[course().id],rows());
 assert.equal(reviewedCourseSkills([{...review(),reviewed:false}],courses).inputs.length,0);
 assert.equal(reviewedCourseSkills([{...review(),skills:[{...review().skills[0],selected:false}]}],courses).inputs.length,0);
 const input=reviewedCourseSkills([review()],courses);assert.equal(input.inputs.length,1);assert.equal(input.inputs[0].origin.kind,'learning_intention');assert.deepEqual(input.inputs[0].origin.fact_ids,[]);
 const career=composeCareerInput('',input.inputs,[],[],value=>value);assert.deepEqual(career.evidence,[]);assert.deepEqual(career.metadata.learning_facts,[]);assert.equal(career.candidates[0].name,'Strategic marketing communications');
});
test('same skill across course IDs deduplicates its bullet while retaining both sources',()=>{
 const a=course(),b=course('WEF-20-A-02'),courses=resumeLearningCourses(new Map([[a.id,a],[b.id,b]]),[a.id,b.id],[]);
 const input=reviewedCourseSkills([review(a.id),review(b.id)],courses);const merged=mergeSkillInputs(input.inputs);
 assert.equal(merged.skills.length,1);assert.equal(input.sources.length,2);assert.equal(new Set(input.sources.map(row=>row.course_id)).size,2);
});
test('stale or removed course sources require review and never silently contribute',()=>{
 const courses=resumeLearningCourses(new Map([[course().id,course()]]),[course().id],rows());
 assert.throws(()=>reviewedCourseSkills([{...review(),source_fingerprint:'old'}],courses),/changed/);
 assert.throws(()=>reviewedCourseSkills([review()],[]),/changed/);
 assert.throws(()=>reviewedCourseSkills([{...review(),skills:[{...review().skills[0],quote:'Unrelated quote'}]}],courses),/reference/);
});
test('course review metadata persists per account and legacy drafts remain readable',()=>{
 const old={...emptyDraft('a'),revision:1};assert.equal(parseResumeRecord(old,'a'),old);
 const current={...old,courseSkillReviews:[review()]};assert.equal(parseResumeRecord(current,'a'),current);
 assert.throws(()=>parseResumeRecord(current,'b'));assert.throws(()=>parseResumeRecord({...current,courseSkillReviews:[null]},'a'));
});
const alignment={occupation_code:'3332',title:'Conference and Event Planners',requirements:[{skill_id:10,name:'Service orientation and customer service'}],task_references:[{id:'task:3332:negotiation',text:'Negotiating service costs'}],links:[{skill_id:'negotiation',name:'Negotiation',requirement_skill_id:null,task_id:'task:3332:negotiation',method:'ai_semantic',origins:[{kind:'reviewed_resume',label:'Reviewed Skills',fact_ids:[]}],examples:[],locations:[{section:'Skills',entry_index:0}]}],summary_fact_ids:[],project_order:[]};
test('task explanations accept only current reference IDs and partial apply limits locations',()=>{
 assert.equal(validRoleAlignment(alignment),true);assert.equal(validRoleAlignment({...alignment,links:[{...alignment.links[0],task_id:'other-role'}]}),false);
 const generation={tailoring_version:'career_evidence_v2',role_alignment:alignment,sections:[],gaps:[]};
 assert.equal(appliedCareerAlignment(generation,{cv:{sections:{}}},['Summary']).alignment.links.length,0);
 assert.equal(appliedCareerAlignment(generation,{cv:{sections:{Skills:[{bullet:'Negotiation'}]}}},['Skills']).alignment.links.length,1);
});
test('assistant adds the program-owned Skills section atomically and one undo restores original',()=>{
 const original={cv:{name:'Local name',sections:{Summary:['Reviewed background.']}}};
 const proposal={message:'Added skill',sections:[{section_index:1,title:'Skills',entries:[{entry:{bullet:'Negotiation'},source_ids:['skill-user']}]}],design:[]};
 const next=applyAssistantProposal(original,proposal,['section-1'],{});assert.deepEqual(next.cv.sections.Skills,[{bullet:'Negotiation'}]);assert.equal(next.cv.name,'Local name');assert.deepEqual(next.cv.sections.Summary,original.cv.sections.Summary);
 const before={...emptyDraft('a'),document:original},after={...before,document:next};const history=createEditorHistory();history.record(before,after);assert.deepEqual(history.undo().document,original);assert.deepEqual(history.redo().document,next);
 assert.throws(()=>applyAssistantProposal(next,proposal,['section-1'],{}),/no longer exists/);
});
test('v2 request transmits role snapshot and course references; extraction has its own 70-second budget',async t=>{
 const calls=[];t.mock.method(api,'post',async(...args)=>{calls.push(args);return {courses:[],sections:[],gaps:[]}});
 const signal=new AbortController().signal;await resumeService.learningSkills(['WEF-10-A-01'],signal);assert.equal(calls[0][0],'/resume/learning-skills');assert.equal(calls[0][2],70000);
 await resumeService.generate('Role',[],[],false,signal,[],[],'3332',{version:'career_evidence_v2',skill_sources:[],learning_facts:[],course_skill_sources:[]},'role-snapshot');assert.equal(calls[1][1].role_reference_fingerprint,'role-snapshot');assert.deepEqual(calls[1][1].source_metadata.course_skill_sources,[]);assert.equal(calls[1][2],70000);
});

test('assistant rejects ambiguous new-section changes and keeps editor limit',()=>{
 const document={cv:{sections:{Summary:['Reviewed background.']}}};const section={section_index:1,title:'Skills',entries:[{entry:{bullet:'Negotiation'},source_ids:['skill-user']}]};
 assert.throws(()=>applyAssistantProposal(document,{message:'Change',sections:[section,section],design:[]},['section-1'],{}),/duplicate/);
 assert.throws(()=>applyAssistantProposal(document,{message:'Change',sections:[{...section,entries:Array(81).fill(section.entries[0])}],design:[]},['section-1'],{}),/no longer exists/);
 assert.deepEqual(document.cv.sections,{Summary:['Reviewed background.']});
});
