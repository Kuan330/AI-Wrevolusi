import type { AssistantMessage, AssistantProposal } from "./assistant.ts";
import { api, ApiError, apiErrorDetail, sessionFetch } from "../../services/api.ts";
import type { CourseSkillReview, Generation, SourceMetadata, SourceSection, SourceProject, ResumeDocument, ResumeEvidence, SkillCandidate, SkillGap, RecommendedCourse } from "./types.ts";
export type ResumeCapabilities = { ai_configured: boolean; ai_provider_host: string; ai_model: string; rendercv_version: string };
export const resumeService = {
  capabilities: (signal: AbortSignal) => api.get<ResumeCapabilities>("/resume/capabilities", signal),
  generate: (job: string, skills: SkillCandidate[], evidence: ResumeEvidence[], reviewed: boolean, signal: AbortSignal, projects: SourceProject[] = [], sections?: SourceSection[], occupationCode?: string, metadata?: SourceMetadata, roleFingerprint?: string) =>
    api.post<Generation>("/resume/generate", { ...(metadata ? { skill_selection: "aggregate", evidence_mode: "auto_redacted", source_metadata: metadata } : {}), ...(roleFingerprint ? { role_reference_fingerprint: roleFingerprint } : {}), ...(occupationCode ? { occupation_code: occupationCode } : {}), job_requirements: job.trim(), skills, evidence, evidence_reviewed: metadata ? false : reviewed, source_projects: projects, ...(sections ? { source_sections: sections } : {}) }, sections ? 70000 : 55000, signal),
  learningSkills: (ids: string[], signal: AbortSignal) => api.post<{ courses: CourseSkillReview[] }>("/resume/learning-skills", { course_ids: ids }, 70000, signal),
  assist: (instruction: string, document: ResumeDocument, skills: SkillCandidate[], history: AssistantMessage[], signal: AbortSignal, targetContext?: string) =>
    api.post<AssistantProposal>("/resume/assist", { instruction, document, skills, history, ...(targetContext ? { target_context: targetContext } : {}), context_mode: "auto_redacted" }, 100000, signal).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 408 && !signal.aborted) {
        throw new ApiError("AI editing timed out. Your resume is unchanged. Try again.", 504, { code: "ai_timeout" });
      }
      throw error;
    }),
  courses: (gaps: SkillGap[], signal: AbortSignal) => api.post<{ courses: RecommendedCourse[] }>("/resume/recommend-courses", { gaps }, 40000, signal),
  async render(document: ResumeDocument, signal: AbortSignal): Promise<Blob> {
    const controller = new AbortController();
    const relay = () => controller.abort();
    signal.addEventListener("abort", relay, { once: true });
    if (signal.aborted) controller.abort();
    const timer = setTimeout(relay, 35000);
    try {
      const response = await sessionFetch("/resume/render", {
        method: "POST", credentials: "include", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new ApiError(apiErrorDetail(body, response.status), response.status, body);
      }
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The renderer did not return a PDF.");
      return await response.blob();
    } finally { clearTimeout(timer); signal.removeEventListener("abort", relay); }
  },
};
