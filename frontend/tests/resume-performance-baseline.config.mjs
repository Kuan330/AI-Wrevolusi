/** Read-only baseline overlays; never reset or edit the active checkout. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "../vite.config.ts";
const frontend = fileURLToPath(new URL("../", import.meta.url));
const before = fileURLToPath(new URL("../../.local/resume-qa/performance/before/", import.meta.url));
const files = ["src/features/resume/document.ts", "src/features/resume/editorHistory.ts", "src/features/resume/skillFilter.ts", "src/features/resume/useResumeDraft.ts", "src/pages/ResumeBuilder/ResumeBuilder.tsx", "src/pages/ResumeBuilder/ResumeWorkbench.tsx", "src/pages/ResumeBuilder/ResumeForm.tsx", "src/pages/ResumeBuilder/CareerAlignment.tsx"];
const overlays = new Map(files.map(file => [path.join(frontend, file).replaceAll("\\", "/").toLowerCase(), readFileSync(path.join(before, "frontend_" + file.replaceAll("/", "_")), "utf8")]));
const applied = new Set();
export default environment => { const config = typeof base === "function" ? base(environment) : base; return { ...config, build: { ...config.build, outDir: path.join(before, "../baseline-dist"), emptyOutDir: false }, plugins: [{ name: "resume-performance-baseline", enforce: "pre", transform(code, id) { const key = id.split("?")[0].replaceAll("\\", "/").toLowerCase(); if (overlays.has(key)) { applied.add(key); return { code: overlays.get(key), map: null }; } }, buildEnd(error) { if (!error && applied.size !== files.length) throw new Error("Not all baseline overlays were applied."); } }, ...config.plugins] }; };
