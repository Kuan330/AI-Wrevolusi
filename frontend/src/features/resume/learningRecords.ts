import type { Course } from "../learning-planning/types.ts";
import type { LearningGoal } from "../learning-goals/learningGoals.ts";
import type { LearningChapterProgress } from "../../services/learningService.ts";
import type { LearningSelection, LearningFact, SourceMetadata } from "./types.ts";
import { TAILORING_VERSION } from "./types.ts";
import type { ResumeSkillInput } from "./skills.ts";
import { mergeResumeSkills, mergeSkillInputs } from "./skills.ts";
import { reviewedResumeInput } from "./projects.ts";
export type LearningRecord = { id: string; label: string; kind: LearningFact["kind"]; text: string; skillNames: string[]; fingerprint: string };
/** Only the server-synchronised snapshot counts. Local pending progress is intentionally absent. */
export function completedResumeCourse(course: Course, progress: LearningChapterProgress[]): boolean {
  if (!course.catalogueChaptersComplete || !course.chapters?.length || !course.skills.length) return false;
  const rows = progress.filter(row => row.course_id === course.id);
  // A course may be tracked under more than one mapped skill; every saved row must be complete.
  return rows.every(row => course.skills.includes(row.skill_id) && Number.isSafeInteger(row.chapter_index) && row.chapter_index >= 0 && row.chapter_index < course.chapters!.length && row.value === 10) &&
    new Set(rows.map(row => JSON.stringify([row.skill_id, row.chapter_index]))).size === rows.length &&
    course.chapters.every((_, index) => rows.some(row => row.chapter_index === index));
}
export function resumeLearningRecords(directory: Map<string, Course>, progress: LearningChapterProgress[], goals: LearningGoal[], namesForCourse: (course: Course) => string[], namesForGoal: (goal: LearningGoal) => string[] = goal => [goal.initial.skill.label]): LearningRecord[] {
  const rows: Omit<LearningRecord, "fingerprint">[] = [];
  for (const course of directory.values()) if (completedResumeCourse(course, progress)) rows.push({ id: "course:" + course.id, label: course.title, kind: "course_completion", text: `${course.title}${course.provider ? " (" + course.provider + ")" : ""}. All catalogue chapters are recorded at 100%; this is not external certification or an assessment of proficiency.`, skillNames: namesForCourse(course) });
  for (const goal of goals) for (const attempt of goal.attempts) rows.push({ id: `practice:${goal.id}:${attempt.id}`, label: goal.initial.skill.label, kind: attempt.type, text: `(${attempt.date}): ${attempt.description}`, skillNames: namesForGoal(goal) });
  if (rows.length > 200) throw new Error("There are more than 200 learning records. Review the learning records before generating; nothing has been truncated.");
  return rows.map(row => ({ ...row, fingerprint: JSON.stringify(row) }));
}
/** Compose reviewed lines into the SAME exact section parser; never fake an uploaded file. */
export function composeCareerInput(resumeText: string, baseSkills: ResumeSkillInput[], records: LearningRecord[], selections: LearningSelection[], redact: (value: string) => string) {
  const selectedSkills = new Map(mergeResumeSkills([baseSkills.map(input => input.skill)]).map(skill => [skill.id, skill]));
  const selected = selections.map(selection => {
    const record = records.find(row => row.id === selection.recordId);
    if (!record || record.fingerprint !== selection.recordFingerprint || !selection.reviewed) throw new Error("Review your selected learning records again. Their source changed or is not confirmed; they have not been silently omitted.");
    if (!selection.text.trim() || selection.text.length > 1700 || /\r|\n/.test(selection.text)) throw new Error("Each learning description must be one factual paragraph of at most 1,700 characters.");
    const text = redact(selection.text).trim();
    if (!text) throw new Error("Add a reviewed learning description before generating.");
    // Preserve nature even after editing: an attempt is not a project/certificate/employment.
    const prefix = record.kind === "course_completion" ? "Self-recorded course completion" : record.kind === "study" ? "Study record" : record.kind === "course_practice" ? "Course practice" : "Workplace practice";
    return { record, text: `${prefix}: ${text}` };
  });
  let text = resumeText.trim();
  const learningRows: { record: LearningRecord; text: string }[] = [];
  for (const [title, kind] of [["Professional Development", "course"], ["Learning practice", "practice"]]) {
    const group = selected.filter(row => (row.record.kind === "course_completion") === (kind === "course"));
    if (group.length) { text += `\n${title}\n` + group.map(row => row.text).join("\n"); learningRows.push(...group); }
  }
  const input = reviewedResumeInput(text);
  const learning_facts: LearningFact[] = [];
  const extraSkills: ResumeSkillInput[] = [];
  // Match composed positions, including identical practice descriptions, from the tail only.
  const appendedFacts = input.evidence.slice(-learningRows.length - new Set(learningRows.map(row => row.record.kind === "course_completion" ? "course" : "practice")).size).filter(fact => fact.text !== "Professional Development" && fact.text !== "Learning practice");
  for (const [index, row] of learningRows.entries()) {
    const fact = appendedFacts[index];
    if (!fact || fact.text !== row.text) throw new Error("Learning facts could not be safely assigned. Review their text before generating.");
    learning_facts.push({ fact_id: fact.id, record_id: row.record.id, kind: row.record.kind, label: redact(row.record.label) });
    for (const name of row.record.skillNames) {
      // Records support the three selected skill sources; they do not add a fourth source.
      const id = mergeResumeSkills([[{ id: name, name }]])[0]?.id;
      const skill = id ? selectedSkills.get(id) : undefined;
      if (skill) extraSkills.push({ skill, origin: { kind: "reviewed_learning", label: redact(row.record.label), fact_ids: [fact.id] } });
    }
  }
  const merged = mergeSkillInputs([...baseSkills, ...extraSkills]);
  const metadata: SourceMetadata = { version: TAILORING_VERSION, skill_sources: merged.sources.map(row => ({ ...row, origins: row.origins.map(origin => ({ ...origin, label: redact(origin.label) })) })), learning_facts };
  return { ...input, candidates: merged.skills, metadata };
}
