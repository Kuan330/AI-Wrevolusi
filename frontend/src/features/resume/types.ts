export type ResumeEntry = string | Record<string, unknown>;
export type ResumeDocument = {
  cv: Record<string, unknown> & { sections?: Record<string, ResumeEntry[]> };
  design?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  settings?: Record<string, unknown>;
};
export type SkillCandidate = { id: string; name: string };
export type ResumeEvidence = { id: string; text: string };
export type SkillGap = { id: string; label: string; keywords: string[]; skill_slugs: string[] };
export type GeneratedSection = { title: string; entries: { text: string; skill_ids: string[]; fact_ids: string[] }[] };
export type Generation = { sections: GeneratedSection[]; gaps: SkillGap[] };
export type RecommendedCourse = { course_id: string; gap_ids: string[]; reason: string };
export type Contacts = { name: string; email: string; phone: string; location: string; website: string };
export type ResumeSource = { file: Blob; name: string; text: string; redactedText: string; contacts: Contacts; skills?: string[]; skillsText?: string; reviewed: boolean };
export type ResumeSnapshot = { document: ResumeDocument; yamlText: string; jobRequirements: string };
export type ResumeDraft = {
  version: 1; owner: string; revision: number; updatedAt: string;
  jobRequirements: string; pendingJobRequirements: string;
  document: ResumeDocument | null; previewDocument?: ResumeDocument | null; yamlText: string;
  source: ResumeSource | null; previous: ResumeSnapshot | null;
  proposal: (Generation & { jobRequirements: string }) | null;
  gaps: SkillGap[]; recommendations: RecommendedCourse[];
};
export const emptyContacts = (): Contacts => ({ name: "", email: "", phone: "", location: "", website: "" });
export const emptyDraft = (owner: string): ResumeDraft => ({
  version: 1, owner, revision: 0, updatedAt: "", jobRequirements: "", pendingJobRequirements: "",
  document: null, previewDocument: null, yamlText: "", source: null, previous: null, proposal: null, gaps: [], recommendations: [],
});
