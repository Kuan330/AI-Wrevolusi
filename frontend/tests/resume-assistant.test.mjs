import test from "node:test";
import assert from "node:assert/strict";
import { applyAssistantProposal, assistantReviewKey, prepareAssistantContext, restoreAssistantValue } from "../src/features/resume/assistant.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { documentYaml } from "../src/features/resume/document.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
const document = { cv: { name: "Alex Doe", email: "alex@example.test", phone: "+61 400 123 456", website: "https://alex.test", sections: { Skills: [{ bullet: "SQL", retained_unknown: "keep" }], Projects: [{ name: "Data Project", summary: "Alex Doe built reports.", authors: ["Alex Doe"] }] } }, design: { theme: "classic", page: { top_margin: "2cm" }, retained_unknown: "keep" }, locale: { language: "english" }, settings: { pdf_title: "My resume" }, custom_top: "keep" };
test("assistant sends known sections and safe design only, redacting names and contacts in all context", () => {
 const context = prepareAssistantContext(document, [{id:"alex@example.test",name:"SQL"}], "Help Alex Doe; email alex@example.test.");
 const sent = JSON.stringify({document:context.document,skills:context.skills,instruction:context.instruction});
 for (const privateValue of ["Alex Doe", "alex@example.test", "+61 400 123 456", "https://alex.test", "retained_unknown", "custom_top", "My resume"]) assert.ok(!sent.includes(privateValue), privateValue);
 assert.equal(context.document.design.page.top_margin,"2cm");
 assert.equal(context.skills[0].id,"candidate-0");
 assert.ok(sent.includes("PRIVATE_"));
 assert.equal(restoreAssistantValue(context.document.cv.sections.Projects[0],context.mapping).summary,document.cv.sections.Projects[0].summary);
});
test("additional confidential terms and incidental contacts are redacted without changing source facts", () => {
 const context=prepareAssistantContext(document,[],"Protect CustomerSecret and secondary@example.test", "CustomerSecret");
 assert.ok(!context.instruction.includes("CustomerSecret") && !context.instruction.includes("secondary@example.test"));
 assert.throws(()=>restoreAssistantValue("[PRIVATE_999]",context.mapping),/unknown private/);
 assert.equal(document.cv.sections.Skills[0].bullet,"SQL");
});
test("partial apply preserves personal info, other sections, locale, settings and unknown fields",()=>{
 const context=prepareAssistantContext(document,[],"Shorten");
 const proposal={message:"Changes",sections:[{section_index:0,entries:[{entry:{bullet:"Knowledge of SQL"},source_ids:["section-0-entry-0"]}]}],design:[{path:["theme"],value:"moderncv"}]};
 const content=applyAssistantProposal(document,proposal,["section-0"],context.mapping);
 assert.equal(content.cv.sections.Skills[0].bullet,"Knowledge of SQL");
 assert.equal(content.cv.sections.Skills[0].retained_unknown,"keep");
 assert.deepEqual(content.cv.sections.Projects,document.cv.sections.Projects);
 assert.equal(content.design.theme,"classic");
 for(const key of ["name","email","phone","website"])assert.equal(content.cv[key],document.cv[key]);
 assert.deepEqual(content.locale,document.locale);assert.deepEqual(content.settings,document.settings);assert.equal(content.custom_top,"keep");
 const design=applyAssistantProposal(document,proposal,["design-0"],context.mapping);
 assert.equal(design.design.theme,"moderncv");assert.deepEqual(design.cv,document.cv);assert.equal(design.design.retained_unknown,"keep");
 assert.notEqual(assistantReviewKey(content,[],""),assistantReviewKey(document,[],""));
});
test("assistant rejects unsupported design paths and stale section indices",()=>{
 assert.throws(()=>applyAssistantProposal(document,{sections:[],design:[{path:["templates","normal_entry"],value:"code"}]},["design-0"],{}),/unsupported design/);
 assert.throws(()=>applyAssistantProposal(document,{sections:[{section_index:99,entries:[]}],design:[]},["section-99"],{}),/no longer exists/);
});
test("applying proposal is one history step and keeps a persistent previous snapshot",()=>{
 const history=createEditorHistory();const before={...emptyDraft("a"),document,yamlText:documentYaml(document),jobRequirements:"SQL"};
 const next=applyAssistantProposal(document,{sections:[],design:[{path:["theme"],value:"moderncv"}]},["design-0"],{});
 const after={...before,document:next,yamlText:documentYaml(next),previous:{document,yamlText:before.yamlText,jobRequirements:"SQL"}};
 history.record(before,after);assert.equal(history.undo().document.design.theme,"classic");assert.equal(history.redo().document.design.theme,"moderncv");
 assert.equal(history.canRedo,false);
});

test("assistant review context changes when selected learning skills are added or removed", () => {
  const initial = assistantReviewKey(document, [{id:"sql",name:"SQL"}], "");
  const changed = assistantReviewKey(document, [{id:"sql",name:"SQL"},{id:"learning",name:"Creative thinking"}], "");
  assert.notEqual(initial,changed);
  assert.equal(initial,assistantReviewKey(document,[{id:"sql",name:"SQL"}],""));
});


test("all validated section and design changes apply atomically, preserving unrelated content", () => {
 const context=prepareAssistantContext(document,[],"Refine");
 const result={message:"Changed",sections:[{section_index:0,entries:[{entry:{bullet:"SQL"},source_ids:["section-0-entry-0"]}]}],design:[{path:["theme"],value:"moderncv"}]};
 const before=structuredClone(document);
 const next=applyAssistantProposal(document,result,["section-0","design-0"],context.mapping);
 assert.equal(next.design.theme,"moderncv");assert.equal(next.cv.sections.Skills[0].bullet,"SQL");assert.deepEqual(next.cv.sections.Projects,before.cv.sections.Projects);
 assert.deepEqual(document,before);
 const bad={...result,design:[{path:["templates","normal_entry"],value:"code"}]};
 assert.throws(()=>applyAssistantProposal(document,bad,["section-0","design-0"],context.mapping),/unsupported/);assert.deepEqual(document,before);
 assert.throws(()=>applyAssistantProposal(document,{...result,sections:[{section_index:0,entries:[{entry:{bullet:"[PRIVATE_999]"},source_ids:["section-0-entry-0"]}]}]},["section-0","design-0"],context.mapping),/unknown private/);
});
test("an unchanged all-sections response does not create a history step", () => {
 const before={...emptyDraft("a"),document,yamlText:documentYaml(document)};
 const result={sections:[],design:[]};const next=applyAssistantProposal(document,result,[],{});
 assert.deepEqual(next,document);
 const history=createEditorHistory();history.record(before,{...before,document:next});assert.equal(history.canUndo,false);
});
test("current private terms redact previous conversation and role context too", () => {
 const context=prepareAssistantContext(document,[],"Refine CustomerSecret", "CustomerSecret");
 for(const content of ["Alex Doe said CustomerSecret", "Target CustomerSecret: secondary@example.test"]) {
  const sent=context.redact(content);assert.ok(!sent.includes("Alex Doe")&&!sent.includes("CustomerSecret")&&!sent.includes("secondary@example.test"));
 }
});


test("assistant wire uses automatic preparation rather than asserting manual review", async () => {
 const {resumeService}=await import("../src/features/resume/service.ts");const {api}=await import("../src/services/api.ts");
 const original=api.post,calls=[];api.post=async(...args)=>{calls.push(args);return {message:"No edit",sections:[],design:[]};};
 try {const controller=new AbortController();await resumeService.assist("Refine",{cv:{sections:{}}},[],[],controller.signal);assert.equal(calls[0][1].context_mode,"auto_redacted");assert.equal(calls[0][1].context_reviewed,undefined);assert.equal(calls[0][2],100000);assert.equal(calls[0][3],controller.signal);} finally {api.post=original;}
});


test("assistant captures selected target changes without substituting the applied interview target", async () => {
 const {readFileSync}=await import("node:fs");
 const assistant=readFileSync(new URL("../src/pages/ResumeBuilder/ResumeAssistant.tsx",import.meta.url),"utf8");
 const parent=readFileSync(new URL("../src/pages/ResumeBuilder/ResumeBuilder.tsx",import.meta.url),"utf8");
 assert.match(assistant,/props\.jobRequirements, props\.targetKey/);
 assert.match(parent,/skills=\{candidates\} targetKey=\{targetKey\} jobRequirements=\{draft\.jobRequirements\}/);
});
