export type ItemKind = "work" | "project" | "skill" | "requirement" | "summary";
export type QuestionKind = "resume_item" | "requirement_practice" | "ai_change" | "general";
export type CheckId = "answered_question" | "own_actions" | "concrete_example" | "judgement" | "ai_check";
export type CheckStatus = "yes" | "partly" | "no" | "not_applicable";
export type ImprovementKind = "expression" | "missing_example" | "possible_skill_gap";

/** One thing in the reviewed resume (or the target role) that a question can be about. */
export type InterviewItem = { id: string; kind: ItemKind; label: string; text: string; ref?: { section: string; index: number } };
export type ChangeTopic = { id: string; text: string; item_id: string; impact_score: number; reference_id: string; source_name: string; source_year: number };

export type CompetencyId = "role_knowledge" | "problem_solving" | "communication" | "quality_care" | "teamwork" | "learning" | "ownership" | "results" | "ai_change";
export type Level = 1 | 2 | 3 | 4;
/** What one answer showed about one skill. It describes the answer, not the person. */
export type CompetencyScore = { competency: CompetencyId; level: Level; quote: string | null; reason: string; next_step: string };
export type StructurePart = "situation" | "task" | "action" | "result";

export type Feedback = {
  summary: string;
  checks: { id: CheckId; status: CheckStatus; quote: string | null; note: string }[];
  improvements: { kind: ImprovementKind; text: string; quote: string | null; uncertain: boolean }[];
  follow_up: string | null;
  skill_gap: { skill_id: number; reason: string } | null;
  /** Added later. Sessions saved before the rubric have none of these. */
  scores?: CompetencyScore[];
  structure?: { part: StructurePart; status: CheckStatus; quote: string | null }[];
  stronger_answer?: string | null;
};
export type PlannedQuestion = { text: string; kind: QuestionKind; item_id: string | null; topic_id: string | null; bank_id: string | null };
export type PlanResult = { source: "ai" | "template"; questions: PlannedQuestion[] };
export type BankQuestion = { id: string; question: string; intent: string | null; scope: "Exact" | "Family" | "Common" | null };
export type QuestionBank = { occupation_code: string; matched: "exact" | "family" | "common"; questions: BankQuestion[] };
