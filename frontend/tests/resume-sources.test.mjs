import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { sourceProjects, reviewedResumeInput } from "../src/features/resume/projects.ts";
import { selectedCourseSkills, mergeResumeSkills } from "../src/features/resume/skills.ts";
import { evidenceFromText, redactResume } from "../src/features/resume/redaction.ts";
import { applySections, parseResumeYaml, documentYaml } from "../src/features/resume/document.ts";
import { parseResumeRecord } from "../src/features/resume/repository.ts";
import { emptyDraft, emptyContacts } from "../src/features/resume/types.ts";

export const sample = `Skills
Excel, SQL, Data cleaning, Data validation
Analytical thinking, Attention to detail, Communication, Teamwork
Projects
Retail Sales Analysis | Apr 2026
• University project using a synthetic retail dataset.
• Cleaned 2,400 transaction records in Excel, corrected dates and removed 36 duplicates.
• Used SQL joins and aggregations to compare monthly sales by product category.
• Prepared pivot tables and charts, and presented three findings to a four-person team.
Student Survey Data Quality Review | Nov 2025
• Reviewed 180 anonymous survey responses for missing values and inconsistent labels.
• Documented cleaning rules and prepared a one-page participation summary.
Education
Classroom demonstration`;

test("sample projects retain identity, date, individual facts and section boundaries", () => {
  const { evidence, projects } = reviewedResumeInput(sample);
  assert.deepEqual(projects.map(p => [p.name, p.date, p.highlight_fact_ids.length]), [["Retail Sales Analysis", "Apr 2026", 4], ["Student Survey Data Quality Review", "Nov 2025", 2]]);
  const projectFacts = projects.flatMap(p => p.fact_ids).map(id => evidence.find(f => f.id === id).text);
  assert.equal(projectFacts.length, 8);
  assert.ok(projectFacts.some(f => f.includes("2,400") && f.includes("36")));
  assert.ok(!projectFacts.includes("Education"));
});
test("separate name/date lines and uppercase project headings are recognized", () => {
  const { projects } = reviewedResumeInput("PROJECTS\nRetail Sales Analysis\nApr 2026\n- Cleaned 36 records.\nEDUCATION\nSchool");
  assert.equal(projects[0].date, "Apr 2026"); assert.equal(projects[0].mode, "structured");
});
test("ambiguous paragraphs remain verbatim without invented identity", () => {
  for (const text of ["Projects\nRetail Sales Analysis Apr 2026\nCleaned 36 records.", "Projects\nUnclear description\n- Used SQL", "Projects\nA Apr 2026\n- Used SQL\nAmbiguous follow-up"]) {
    const { projects, evidence } = reviewedResumeInput(text);
    assert.equal(projects.length, 1); assert.equal(projects[0].mode, "verbatim"); assert.equal(projects[0].name, undefined);
    assert.deepEqual(projects[0].fact_ids, evidence.slice(1).map(f => f.id));
  }
});
test("no projects produces an explicit empty list; over-limit raw text is never truncated", () => {
  assert.deepEqual(sourceProjects(evidenceFromText("Skills\nSQL")), []);
  assert.throws(() => reviewedResumeInput("Projects\n" + Array.from({ length: 81 }, (_, i) => `Unknown paragraph ${i}`).join("\n")), /80 paragraphs/);
});
test("editing reviewed text recomputes project references and redaction precedes extraction", () => {
  const contacts = { ...emptyContacts(), email: "private@example.test" };
  const parsed = reviewedResumeInput(redactResume("private@example.test\n" + sample, contacts));
  assert.ok(!parsed.evidence.some(f => f.text.includes("@")));
  const changed = reviewedResumeInput("Introduction\n" + sample.replace("Apr 2026", "May 2026"));
  assert.equal(changed.projects[0].date, "May 2026"); assert.notDeepEqual(changed.projects[0].fact_ids, parsed.projects[0].fact_ids);
});
const reference = [{ wef_skill_id: 1, core_skill: "Analytical thinking" }, { wef_skill_id: 2, core_skill: "Creative thinking" }];
test("saved and planned courses resolve canonical skill names, not course titles", () => {
  const directory = new Map([["saved", { title: "Expert Certificate", skills: ["analytical-thinking"] }], ["planned", { title: "Masterclass", skills: ["creative-thinking", "analytical-thinking"] }]]);
  const skills = selectedCourseSkills(reference, directory, ["saved", "planned", "saved"]);
  assert.deepEqual(skills.map(s => s.name), ["Analytical thinking", "Creative thinking"]);
  assert.ok(!JSON.stringify(skills).includes("Certificate"));
  assert.deepEqual(selectedCourseSkills(reference, directory, []), []);
});
test("missing course or unknown skill mappings fail closed", () => {
  assert.throws(() => selectedCourseSkills(reference, new Map(), ["missing"]), /could not be resolved/);
  assert.throws(() => selectedCourseSkills(reference, new Map([["a", { skills: ["unknown-skill"] }]]), ["a"]), /unknown skill mapping/);
  assert.throws(() => selectedCourseSkills(reference, new Map([["a", { skills: [] }]]), ["a"]), /could not be resolved/);
});
test("all learning intent sources join confirmed skills, never untouched suggestions", () => {
  let code = readFileSync(new URL("../src/features/resume/skills.ts", import.meta.url), "utf8");
  code = code.replace(/^import .*;\r?$/gm, "");
  const dependencies = `const resolveCatalogueSkill=(id,ref)=>{const s=ref.find(s=>String(s.wef_skill_id)===String(id)||s.core_skill===id);return s?{id:s.wef_skill_id,name:s.core_skill}:null};
const readLearningGoals = () => [{ initial: { skill: {id:"g",label:"Goal skill"}}}];
const readLibrary = () => ({saved:[],pending:[]});
const readLearningSkills = () => [{id:"l",name:"Learning skill"}];
const readCareerPath = () => ({ids:[2]});
const readJourneyState = () => ({review:{decisions:{"1":"accepted","3":"rejected"}},contexts:{c:{skill:{id:4,name:"Context skill"}}},personalSkills:[{id:"p",name:"Personal skill",decision:"use"},{id:"x",name:"Untouched suggestion",decision:null}]});
const isSkillReviewCurrent = () => true;
const personalSkillIsCurrent = () => true;
const readJourneyProfile = () => ({tasks:[]});
const readSpecialistState = () => ({entries:[{skillUri:"s",skillLabel:"Specialist learning",wantsLearning:true}]});
const specialistEntryIsCurrent = () => true;`;
  const js = ts.transpileModule(dependencies + code, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(js).toString("base64")).then(m => {
    assert.deepEqual(m.resumeSkillSnapshot([...reference,{wef_skill_id:4,core_skill:"Context skill"}]).map(s => s.name), ["Analytical thinking", "Context skill", "Creative thinking", "Goal skill", "Learning skill", "Personal skill", "Specialist learning"]);
  });
});
test("dedup preserves C/C++/C# and learning names without status groups", () => {
  const skills = mergeResumeSkills([[{id:"a",name:" SQL "},{id:"b",name:"sql"}], ["C", "C++", "C#"].map(name => ({id:name,name}))]);
  assert.equal(skills.length, 4); assert.ok(skills.every(s => Object.keys(s).sort().join() === "id,name"));
});
test("structured proposals render as NormalEntry and old bullet proposals still work", () => {
  const entries = [{text:"Retail Sales Analysis",skill_ids:[],fact_ids:["p"],project_id:"project-1",project:{name:"Retail Sales Analysis",date:"Apr 2026",highlights:["Cleaned 2,400 records.","Removed 36 duplicates."]}}];
  const doc = applySections(null, [{title:"Projects",entries}]);
  assert.deepEqual(doc.cv.sections.Projects[0], entries[0].project);
  assert.equal(parseResumeYaml(documentYaml(doc)).error, "");
  const raw = applySections(null,[{title:"Projects",entries:[{text:"Original raw paragraph",project_id:"raw",skill_ids:[],fact_ids:["p"]}]}]);
  assert.deepEqual(raw.cv.sections.Projects,["Original raw paragraph"]); assert.equal(parseResumeYaml(documentYaml(raw)).error, "");
  assert.deepEqual(applySections(null,[{title:"Projects",entries:[{text:"Original raw paragraph",skill_ids:[],fact_ids:["p"]}]}]).cv.sections.Projects, [{bullet:"Original raw paragraph"}]);
});
test("legacy drafts and structured-source metadata remain compatible; malformed metadata fails closed", () => {
  const legacy = {...emptyDraft("a"),revision:1}; assert.equal(parseResumeRecord(legacy,"a"), legacy);
  const current = {...legacy,generationInputFingerprint:"input",source:{file:new Blob(),name:"local",text:sample,redactedText:sample,contacts:emptyContacts(),reviewed:true,projects:reviewedResumeInput(sample).projects},proposal:{sections:[{title:"Projects",entries:[{text:"Retail",skill_ids:[],fact_ids:[],project:{name:"Retail",date:"Apr 2026",highlights:["Used SQL"]}}]}],gaps:[],jobRequirements:"role",inputFingerprint:"input"}};
  assert.equal(parseResumeRecord(current,"a"),current);
  assert.throws(() => parseResumeRecord({...current,source:{...current.source,projects:[{}]}},"a"), /not been overwritten/);
  assert.throws(() => parseResumeRecord({...current,proposal:{...current.proposal,sections:[{title:"Projects",entries:[{text:"bad",skill_ids:[],fact_ids:[],project:{name:3}}]}]}},"a"), /not been overwritten/);
});
