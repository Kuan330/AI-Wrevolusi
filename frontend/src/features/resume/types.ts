import type { OccupationRequirements } from "../../services/possibilitiesTypes.ts";
export const SKILL_FILTER_VERSION = "role_relevance_v1" as const;
export type SkillFilterVersion = typeof SKILL_FILTER_VERSION;
export type ResumeEntry = string | Record<string, unknown>;
export type ResumeDocument = {
  cv: Record<string, unknown> & { sections?: Record<string, ResumeEntry[]> | null };
  design?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};
export type SkillCandidate = { id: string; name: string };
export type ResumeEvidence = { id: string; text: string };
export type SkillGap = { id: string; label: string; keywords: string[]; skill_slugs: string[] };
export type SourceProject = { id: string; mode: "structured" | "verbatim"; fact_ids: string[]; name?: string | null; date?: string | null; highlight_fact_ids: string[] };
export type SourceSection = { title: string; heading_fact_id: string | null; fact_ids: string[]; polishable_fact_ids: string[] };
export type ProjectEntry = { name: string; date: string | null; highlights: string[] };
export type GeneratedSection = { title: string; entries: { text: string; skill_ids: string[]; fact_ids: string[]; project_id?: string | null; project?: ProjectEntry | null; verbatim?: boolean }[] };
export type Generation = { skill_filter_version?: SkillFilterVersion | null; sections: GeneratedSection[]; gaps: SkillGap[]; outcome?: "tailored" | "source_preserved" | null; notices?: string[] };
export type RecommendedCourse = { course_id: string; gap_ids: string[]; reason: string };
export type Contacts = { name: string; email: string; phone: string; location: string; website: string };
export type ResumeSource = { file: Blob; name: string; text: string; redactedText: string; contacts: Contacts; skills?: string[]; skillsText?: string; skillsParserVersion?: number; skillsOrigin?: "extracted" | "manual"; projects?: SourceProject[]; reviewed: boolean };
export type ResumeSnapshot = { skillFilterVersion?: SkillFilterVersion; skillFilterInputFingerprint?: string; generationOutcome?: Generation["outcome"]; generationNotices?: string[]; generationInputFingerprint?: string; document: ResumeDocument; yamlText: string; jobRequirements: string };
/** The user confirmed this version of the resume content. `fingerprint` ties the mark to that content. */
export type ReviewedMark = { at: string; fingerprint: string };
/** A point from interview practice, offered on one resume entry. It changes nothing until accepted. */
export type InterviewSuggestion = {
  id: string; sessionId: string; createdAt: string; section: string; entryIndex: number; entryLabel: string; text: string; question: string;
};
export type ResumeDraft = {
  version: 1; owner: string; revision: number; updatedAt: string;
  reviewed?: ReviewedMark | null; interviewSuggestions?: InterviewSuggestion[];
  skillFilterVersion?: SkillFilterVersion; skillFilterInputFingerprint?: string; generationInputFingerprint?: string; generationOutcome?: Generation["outcome"]; generationNotices?: string[]; targetRole?: OccupationRequirements | null; legacyPendingJobRequirements?: string;
  jobRequirements: string; pendingJobRequirements: string;
  document: ResumeDocument | null; previewDocument?: ResumeDocument | null; yamlText: string;
  source: ResumeSource | null; previous: ResumeSnapshot | null;
  proposal: (Generation & { jobRequirements: string; inputFingerprint?: string }) | null;
  gaps: SkillGap[]; recommendations: RecommendedCourse[];
};
export const emptyContacts = (): Contacts => ({ name: "", email: "", phone: "", location: "", website: "" });
export const emptyDraft = (owner: string): ResumeDraft => ({
  version: 1, owner, revision: 0, updatedAt: "", jobRequirements: "", pendingJobRequirements: "",
  document: null, previewDocument: null, yamlText: "", source: null, previous: null, proposal: null, gaps: [], recommendations: [],
});
