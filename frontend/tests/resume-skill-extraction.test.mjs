import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { explicitResumeSkills, reviewedSourceSkills, SKILLS_PARSER_VERSION } from "../src/features/resume/sourceSkills.ts";
import { reviewedResumeInput } from "../src/features/resume/projects.ts";
import { sourceHeading } from "../src/features/resume/sections.ts";
import { detectContacts, redactResume } from "../src/features/resume/redaction.ts";
import { generationNotice } from "../src/features/resume/generationNotice.ts";
import { applySections } from "../src/features/resume/document.ts";
import { mergeResumeSkills, canonicalResumeSkill } from "../src/features/resume/skills.ts";
import { activateWorkspace } from "../src/services/accountStorage.ts";

const insurance = `Core Skills
•Sales & Advisory:Needs analysis, cross-selling, policy renewals, lead generation
•Product Knowledge:Life, medical, motor, property, and travel insurance
•Compliance:Underwriting guidelines, KYC/AML, claims documentation
•Soft Skills:Negotiation, active listening, client retention, objection handling
•T ools:Salesforce, Microsoft Office, CRM systems
Professional Experience
Insurance Sales Representative Jan 2021 – Present
ABC Insurance Berhad, Kuala Lumpur
•Manage a portfolio of 250+ clients, achieving a 92% policy renewal rate
•Exceeded annual sales quota by 18% for three consecutive years
Customer Service Associate Jun 2018 – Dec 2020
XYZ Financial Services, Petaling Jaya
Education
University of Malaya`;

test("insurance Skills stops before employers, cities and quantitative achievements", () => {
  const skills = explicitResumeSkills(insurance);
  assert.deepEqual(skills, ["Needs analysis", "cross-selling", "policy renewals", "lead generation", "Life, medical, motor, property, and travel insurance", "Underwriting guidelines", "KYC/AML", "claims documentation", "Negotiation", "active listening", "client retention", "objection handling", "Salesforce", "Microsoft Office", "CRM systems"]);
  assert.ok(!skills.some(s => /Jaya|Berhad|92%|250\+|Experience|Jan 2021/.test(s)));
  const input = reviewedResumeInput(insurance);
  assert.deepEqual(input.projects, []);
  assert.ok(input.sections.find(s => s.title === "Experience").fact_ids.some(id => input.evidence.find(f => f.id === id).text.includes("92%")));
});
test("standard section variants terminate both Skills and Projects", () => {
  for (const heading of ["Professional Experience", "WORK HISTORY", "Licenses & Certifications", "Academic Background", "Achievements", "Publications"]) {
    assert.ok(sourceHeading(heading));
    assert.deepEqual(explicitResumeSkills(`Skills\nSQL\n${heading}\nPetaling Jaya`), ["SQL"]);
    const { projects } = reviewedResumeInput(`Projects\nSales | Apr 2026\n- Cleaned 36 records.\n${heading}\nOther text`);
    assert.equal(projects[0].fact_ids.length, 2);
  }
  assert.equal(sourceHeading("SQL"), null);
});
test("nested and repeated Skills headings retain every explicitly listed skill", () => {
  const text = "Skills\nSQL\nTechnical Skills\nPython, C++\nSoft Skills\nCommunication\nExperience\nWorked with records\nProfessional Skills\nSQL; Negotiation\nEducation\nSample University";
  assert.deepEqual(explicitResumeSkills(text), ["SQL", "Python", "C++", "Communication", "Negotiation"]);
});
test("inline skill labels retain their values and resume scanning later skill blocks", () => {
  const text = "Technical Skills: SQL, Python\nTools:\nExcel\nExperience\nWorked with Java\n• Soft Skills：Communication; Negotiation\nEducation\nSample University";
  assert.deepEqual(explicitResumeSkills(text), ["SQL", "Python", "Excel", "Communication", "Negotiation"]);
  assert.deepEqual(explicitResumeSkills("Worked with SQL and Python\nEducation\nSample University"), []);
});
test("standalone tool category labels are not skills", () => {
  assert.deepEqual(explicitResumeSkills("Skills\nTools\nExcel\nTechnologies\nPython\nExperience\nSample employer"), ["Excel", "Python"]);
});
test("explicit skill labels survive verbs that also begin work descriptions", () => {
  assert.deepEqual(explicitResumeSkills("Skills\nSupport\nManaged services\nWork ethic\nHandling objections"), ["Support", "Managed services", "Work ethic", "Handling objections"]);
});
test("terminal software versions remain skills while quantified achievements are rejected", () => {
  const text = "Skills\nPython 3+\n.NET 6+\nJava 8+\nPostgreSQL 13.2+\nManaged 250+ clients\nManaged 250+\n250+ clients\nAchieved 95% satisfaction";
  const expected = ["Python 3+", ".NET 6+", "Java 8+", "PostgreSQL 13.2+"];
  assert.deepEqual(explicitResumeSkills(text), expected);
  const manual = reviewedSourceSkills({redactedText:text,skillsText:expected.join("\n"),skillsOrigin:"manual",skillsParserVersion:SKILLS_PARSER_VERSION});
  assert.deepEqual(manual.names, expected);
  assert.deepEqual(manual.rejected, []);
});
test("indented skill bullets normalize before deduplication", () => {
  assert.deepEqual(explicitResumeSkills("Skills\n  - SQL\n  * Python\n  • C++\nSQL"), ["SQL", "Python", "C++"]);
});
test("recognized inline non-skill headings stop skill scanning without losing source facts", () => {
  const parsed = reviewedResumeInput("Skills: SQL\nExperience: Analyst\n- Managed reports\nSummary: Experienced analyst\nEducation: Example University\nTechnical Skills: Python");
  assert.deepEqual(explicitResumeSkills(parsed.evidence.map(fact => fact.text).join("\n")), ["SQL", "Python"]);
  assert.deepEqual(parsed.sections, [
    {title:"Skills",heading_fact_id:null,fact_ids:["fact-1"],polishable_fact_ids:[]},
    {title:"Experience",heading_fact_id:null,fact_ids:["fact-2","fact-3"],polishable_fact_ids:["fact-3"]},
    {title:"Summary",heading_fact_id:null,fact_ids:["fact-4"],polishable_fact_ids:["fact-4"]},
    {title:"Education",heading_fact_id:null,fact_ids:["fact-5"],polishable_fact_ids:[]},
    {title:"Skills",heading_fact_id:null,fact_ids:["fact-6"],polishable_fact_ids:[]},
  ]);
});
test("competency and expertise headings retain skill ownership", () => {
  for (const heading of ["Core competencies", "Key competencies", "Technical expertise", "• Technical Skills"]) {
    assert.equal(sourceHeading(heading), "Skills");
    assert.deepEqual(explicitResumeSkills(`${heading}\nSQL\nExperience\nSample employer`), ["SQL"]);
    assert.deepEqual(reviewedResumeInput(`${heading}\nSQL`).sections, [{title:"Skills",heading_fact_id:"fact-1",fact_ids:["fact-2"],polishable_fact_ids:[]}]);
  }
});

test("nameless resumes keep first-line skill headings through contact redaction", () => {
  for (const heading of ["Core competencies", "Key competencies", "Technical expertise", "Core competencies: SQL, Python"]) {
    const text = `${heading}\nSQL\nPython\nExperience\nSample employer`;
    const contacts = detectContacts(text);
    assert.equal(contacts.name, "");
    assert.deepEqual(explicitResumeSkills(redactResume(text, contacts)), ["SQL", "Python"]);
  }
});

test("real names are still redacted without losing later skill blocks", () => {
  const text = "Jane Doe\nCore competencies\nSQL\nTechnical expertise: Python";
  const contacts = detectContacts(text);
  assert.equal(contacts.name, "Jane Doe");
  const redacted = redactResume(text, contacts);
  assert.ok(!redacted.includes("Jane Doe"));
  assert.deepEqual(explicitResumeSkills(redacted), ["SQL", "Python"]);
});
test("inline skill blocks keep their entire source fact and terminate project ownership", () => {
  const parsed = reviewedResumeInput("Projects\nSales | Apr 2026\n- Cleaned 36 records.\nTechnical Skills: Data visualization\nCore competencies：SQL, Python\nEducation\nSample University");
  assert.deepEqual(parsed.projects[0].fact_ids, ["fact-2", "fact-3"]);
  assert.deepEqual(parsed.sections.filter(section => section.title === "Skills"), [
    {title:"Skills",heading_fact_id:null,fact_ids:["fact-4"],polishable_fact_ids:[]},
    {title:"Skills",heading_fact_id:null,fact_ids:["fact-5"],polishable_fact_ids:[]},
  ]);
  assert.deepEqual(explicitResumeSkills(parsed.evidence.map(fact => fact.text).join("\n")), ["Data visualization", "SQL", "Python"]);
});
test("legacy automatic skills are rederived, not loaded from the polluted array", () => {
  const source = {redactedText: insurance, skills: ["Petaling Jaya", "achieving a 92% policy renewal rate"]};
  const clean = reviewedSourceSkills(source);
  assert.ok(clean.names.includes("Salesforce")); assert.ok(!clean.names.includes("Petaling Jaya"));
  assert.deepEqual(source.skills, ["Petaling Jaya", "achieving a 92% policy renewal rate"]);
});
test("manual real skills survive and definite history contamination requires correction", () => {
  const clean = reviewedSourceSkills({redactedText: insurance, skillsText: "SQL\nC++\nPetaling Jaya\nachieving a 92% policy renewal rate", skillsOrigin:"manual", skillsParserVersion:SKILLS_PARSER_VERSION});
  assert.deepEqual(clean.names, ["SQL", "C++"]);
  assert.deepEqual(clean.rejected, ["Petaling Jaya", "achieving a 92% policy renewal rate"]);
  assert.deepEqual(reviewedSourceSkills({redactedText: "Skills\nSQL", skillsText:"SQL, C++"}).names, ["SQL", "C++"]);
});
test("manually removed skills stay removed even when later source blocks contain them", () => {
  const source = {redactedText:"Skills: SQL, Python\nExperience\nSample employer\nSoft Skills\nCommunication",skillsOrigin:"manual",skillsParserVersion:SKILLS_PARSER_VERSION};
  assert.deepEqual(reviewedSourceSkills({...source,skillsText:"SQL"}).names, ["SQL"]);
  assert.deepEqual(reviewedSourceSkills({...source,skillsText:""}).names, []);
  assert.deepEqual(reviewedSourceSkills({...source,skillsText:"SQL\nCommunication"}).rejected, []);
});
test("skill-bearing punctuation remains intact in new one-per-line manual records", () => {
  assert.deepEqual(reviewedSourceSkills({redactedText: insurance,skillsText:"Life, medical, motor, property, and travel insurance\nC#",skillsParserVersion:2,skillsOrigin:"manual"}).names, ["Life, medical, motor, property, and travel insurance", "C#"]);
  assert.equal(mergeResumeSkills([[{id:"1",name:"C"},{id:"2",name:"C++"},{id:"3",name:"C#"}]]).length,3);
});
test("standard WEF IDs override stale labels and selected course titles resolve to mapped skills", () => {
  const memory=new Map();
  globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  globalThis.window=new EventTarget();
  activateWorkspace("canonical-resume-test",{data:{"aiwrevolusi.courseLibrary.v1":JSON.stringify({version:1,workContext:"",skillId:"",saved:["course"],choices:{},basis:{},pending:[]})},revision:0});
  const ref=[{wef_skill_id:1,core_skill:"Reading, writing and mathematics"}];
  const directory=new Map([["course",{id:"course",title:"Everyday English 1",skills:["reading-writing-and-mathematics"]}]]);
  assert.deepEqual(canonicalResumeSkill("1","Everyday English 1",ref,directory,true),[{id:"1",name:"Reading, writing and mathematics"}]);
  assert.deepEqual(canonicalResumeSkill("everyday-english-1","Everyday English 1",ref,directory),[{id:"skill:reading, writing and mathematics",name:"Reading, writing and mathematics"}]);
  assert.throws(()=>canonicalResumeSkill("999","Unresolved stale skill",ref,directory,true),/standard name/);
  assert.deepEqual(canonicalResumeSkill("custom","My custom skill",ref,directory),[{id:"custom",name:"My custom skill"}]);
  assert.deepEqual(canonicalResumeSkill("1","My personal skill",ref,directory),[{id:"1",name:"My personal skill"}]);
  activateWorkspace(null);
});
test("raw source sections apply as literal paragraphs rather than fabricated bullets", () => {
  assert.deepEqual(applySections(null,[{title:"Licenses & Certifications",entries:[{text:"Original license text",fact_ids:["f"],skill_ids:[],verbatim:true}]}]).cv.sections["Licenses & Certifications"],["Original license text"]);
  assert.match(generationNotice("source_preserved",["ai_timeout"]),/timed out/);
  assert.match(generationNotice("source_preserved",["ai_output_invalid"]),/not marked as tailored/);
  assert.equal(generationNotice("tailored"),"");
});
test("the combined skills preview is absent but source review and progress controls remain", () => {
  const ui=readFileSync(new URL("../src/pages/ResumeBuilder/ResumeBuilder.tsx",import.meta.url),"utf8");
  assert.ok(!ui.includes("Skills included in your resume"));
  assert.ok(ui.includes("Skills explicitly listed in your original resume"));
  assert.ok(ui.includes("Cancel generation"));
});

test("repeated project sections retain every source block with unique project IDs",()=>{
  const parsed=reviewedResumeInput("Professional Projects\nFirst | Apr 2026\n- Cleaned 36 records.\nProfessional Experience\nAcme\nAcademic Projects\nSecond | Nov 2025\n- Reviewed 180 responses.");
  assert.deepEqual(parsed.projects.map(p=>p.id),["project-1","project-2"]);
  assert.deepEqual(parsed.projects.map(p=>p.name),["First","Second"]);
});
