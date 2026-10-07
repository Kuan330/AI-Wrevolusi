import { detectContacts, redactResume } from "./redaction.ts";
import { explicitResumeSkills } from "./sourceSkills.ts";
import type { ResumeSource } from "./types.ts";
export const RESUME_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const isResumeFile = (file: Pick<File, "name">) => /\.(pdf|docx)$/i.test(file.name);
export function validateResumeFile(file: Pick<File, "name" | "size">) {
  if (!isResumeFile(file)) return "Upload a PDF or DOCX resume.";
  if (file.size < 1 || file.size > MAX_RESUME_BYTES) return "Resume files must be non-empty and at most 10 MB.";
  return "";
}
export async function importResume(file: File, signal?: AbortSignal): Promise<ResumeSource> {
  const issue = validateResumeFile(file);
  if (issue) throw new Error(issue);
  if (signal?.aborted) throw new Error("Resume import cancelled.");
  const buffer = await file.arrayBuffer();
  const text = await new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL("./extract.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => { clearTimeout(timer); worker.terminate(); signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new Error("Resume import cancelled.")); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Document parsing timed out. Try a simpler text-based PDF or DOCX.")); }, 20000);
    worker.onmessage = event => { cleanup(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.text); };
    worker.onerror = () => { cleanup(); reject(new Error("The document parser could not start. Reload or enter your details manually.")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.postMessage({ buffer, kind: /\.pdf$/i.test(file.name) ? "pdf" : "docx" }, [buffer]);
  });
  const contacts = detectContacts(text);
  return { file, name: file.name, text, contacts, skills: explicitResumeSkills(redactResume(text, contacts)), redactedText: redactResume(text, contacts), reviewed: false };
}
