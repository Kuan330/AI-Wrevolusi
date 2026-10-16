import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getDocument } from '../../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import { explicitResumeSkills } from '../../frontend/src/features/resume/sourceSkills.ts';
import { detectContacts, redactResume } from '../../frontend/src/features/resume/redaction.ts';
import { reviewedResumeInput } from '../../frontend/src/features/resume/projects.ts';

const baseline=process.argv.includes('--baseline');
const pdfPath = new URL('../../output/pdf/'+(baseline?'accountant-baseline-demo.pdf':'accountant-ict-sales-website-demo.pdf'), import.meta.url);
const task = getDocument({ data: new Uint8Array(readFileSync(pdfPath)), useSystemFonts: false, disableFontFace: true,
  standardFontDataUrl: fileURLToPath(new URL('../../frontend/node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replaceAll('\\', '/') });
const pdf = await task.promise;
let text = '';
for (let page=1; page<=pdf.numPages; page++) {
  const content = await (await pdf.getPage(page)).getTextContent();
  let y=null;
  // Same item-to-line logic as the website's extract.worker.ts.
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const nextY=item.transform[5];
    if (y!==null && Math.abs(nextY-y)>2 && !text.endsWith('\n')) text+='\n';
    text+=item.str+(item.hasEOL?'\n':' ');
    y=nextY;
  }
  text+='\n';
}
const contacts=detectContacts(text);
const redacted=redactResume(text, contacts);
const skills=explicitResumeSkills(redacted);
const parsed=reviewedResumeInput(redacted);
const expected=baseline?['Financial reporting','Budgeting and forecasting','Bank reconciliations','Microsoft Excel','Xero','MYOB']:['Analytical thinking','Technological literacy','Service orientation and customer service','Empathy and active listening','Financial report writing','Financial reporting','Budgeting and forecasting','Bank reconciliations','Microsoft Excel','Xero','MYOB','Client needs analysis'];
assert.equal(pdf.numPages,1);
assert.deepEqual(skills,expected);
assert.equal(contacts.name,'ALEX MORGAN');
assert.equal(contacts.email,'alex.morgan@example.com');
assert.ok(!redacted.includes(contacts.email));
assert.ok(!redacted.includes(contacts.name));
assert.deepEqual(parsed.projects.map(p=>({name:p.name,date:p.date,mode:p.mode})),[
  {name:'Cloud Accounting Software Evaluation',date:'Apr 2026',mode:'structured'},
  {name:'Monthly Reporting Improvement',date:'Nov 2025',mode:'structured'},
]);
assert.deepEqual(parsed.projects.map(p=>p.highlight_fact_ids.length),[3,2]);
assert.ok(parsed.sections.some(s=>s.title==='Experience'));
assert.ok(parsed.sections.some(s=>s.title==='Education'));
const report={checks:'passed',pages:pdf.numPages,bytes:readFileSync(pdfPath).length,contacts,skills,projects:parsed.projects,sections:parsed.sections.map(s=>s.title)};
writeFileSync(new URL(baseline?'./accountant-baseline-verification.json':'./accountant-demo-verification.json',import.meta.url),JSON.stringify(report,null,2));
writeFileSync(new URL(baseline?'./accountant-baseline-extracted.txt':'./accountant-demo-extracted.txt',import.meta.url),text);
console.log(JSON.stringify(report,null,2));
await task.destroy();
