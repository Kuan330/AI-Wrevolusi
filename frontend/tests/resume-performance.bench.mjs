/** Reproducible synthetic CPU baseline; no provider calls. */
import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import * as documents from "../src/features/resume/document.ts";
import { createEditorHistory } from "../src/features/resume/editorHistory.ts";
import { invalidateEditedSkills } from "../src/features/resume/skillFilter.ts";
import { emptyDraft } from "../src/features/resume/types.ts";
import { performanceDocument, performanceAlignment } from "./resume-performance-fixtures.mjs";
const document = performanceDocument(), yaml = documents.documentYaml(document);
const samples = (name, task, count = 80) => { for (let i = 0; i < 8; i++) task(i); const times = []; for (let i = 0; i < count; i++) { const start = performance.now(); task(i); times.push(performance.now() - start); } times.sort((a, b) => a - b); return { name, median_ms: times[Math.floor(times.length / 2)], p95_ms: times[Math.floor(times.length * .95)] }; };
const result = [samples("yaml_parse_and_preview", () => { documents.parseResumeYaml(yaml); documents.parseResumeYaml(documents.documentYaml(documents.resumeRenderDocument(document))); }),
  samples("object_validation_and_preview", () => { const validate = documents.validateResumeDocument; if (validate) { validate(document, yaml); validate(documents.resumeRenderDocument(document)); } else { documents.parseResumeYaml(yaml); documents.parseResumeYaml(documents.documentYaml(documents.resumeRenderDocument(document))); } }),
  samples("history_and_proof_edit", index => {
    const before = { ...emptyDraft("performance"), document, yamlText: yaml, careerAlignment: performanceAlignment(document) };
    const edited = { ...document, cv: { ...document.cv, name: `Synthetic name ${index}` } };
    const after = invalidateEditedSkills(before, { ...before, document: edited, yamlText: documents.documentYaml(edited) });
    createEditorHistory().record(before, after, "name", index);
  })];
const out = new URL(`../../.local/resume-qa/performance/${process.env.AIW_PERF_LABEL || "baseline"}-cpu.json`, import.meta.url);
await mkdir(new URL(".", out), { recursive: true }); await writeFile(out, JSON.stringify({ synthetic_only: true, skills: 250, yaml_chars: yaml.length, samples: result }, null, 2)); console.log(JSON.stringify(result));
