import { api, ApiError, apiErrorDetail } from "../../services/api.ts";
import type { Generation, ResumeDocument, ResumeEvidence, SkillCandidate, SkillGap, RecommendedCourse } from "./types.ts";
export type ResumeCapabilities = { ai_configured: boolean; ai_provider_host: string; ai_model: string; rendercv_version: string };
export const resumeService = {
  capabilities: (signal: AbortSignal) => api.get<ResumeCapabilities>("/resume/capabilities", signal),
  generate: (job: string, skills: SkillCandidate[], evidence: ResumeEvidence[], reviewed: boolean, signal: AbortSignal) =>
    api.post<Generation>("/resume/generate", { job_requirements: job.trim(), skills, evidence, evidence_reviewed: reviewed }, 55000, signal),
  courses: (gaps: SkillGap[], signal: AbortSignal) => api.post<{ courses: RecommendedCourse[] }>("/resume/recommend-courses", { gaps }, 40000, signal),
  async render(document: ResumeDocument, signal: AbortSignal): Promise<Blob> {
    const controller = new AbortController();
    const relay = () => controller.abort();
    signal.addEventListener("abort", relay, { once: true });
    if (signal.aborted) controller.abort();
    const timer = setTimeout(relay, 35000);
    try {
      const response = await fetch(`${import.meta.env?.VITE_API_BASE_URL ?? "/api/v1"}/resume/render`, {
        method: "POST", credentials: "include", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document }),
      });
      if (!response.ok) throw new ApiError(apiErrorDetail(await response.json().catch(() => null), response.status), response.status);
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The renderer did not return a PDF.");
      return await response.blob();
    } finally { clearTimeout(timer); signal.removeEventListener("abort", relay); }
  },
};
