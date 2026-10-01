import type { ProfileTask } from "@/features/work-profile/types";
import type {
  ConfirmedTaskExposureAssessment,
  MatchedIloTaskExposureEvidence,
} from "@/services/exposureService";

export interface TaskResearch {
  kind: "linked" | "candidate" | "gap";
  label: string;
  references: MatchedIloTaskExposureEvidence[];
}

const normalizeWording = (wording: string) => wording.trim().replace(/\s+/g, " ").toLowerCase();

function validReference(reference: MatchedIloTaskExposureEvidence): boolean {
  return Boolean(
    reference &&
    typeof reference.ilo_task_id === "string" && reference.ilo_task_id.trim() &&
    typeof reference.task_text === "string" && reference.task_text.trim() &&
    Number.isFinite(reference.score_2025) &&
    reference.score_2025 >= 0 && reference.score_2025 <= 1,
  );
}

/** Keep published reference values separate from app estimates and possible matches. */
export function taskResearch(
  task: ProfileTask,
  assessment?: ConfirmedTaskExposureAssessment | null,
): TaskResearch {
  const gap: TaskResearch = { kind: "gap", label: "No supported research link", references: [] };
  if (
    !assessment || assessment.task_id !== task.id ||
    assessment.match_layer === "insufficient_data" ||
    assessment.missing_data_status === "no_reliable_match" ||
    assessment.missing_data_status === "missing_reference_tasks" ||
    !Array.isArray(assessment.matched_reference_tasks)
  ) return gap;

  const references = assessment.matched_reference_tasks.filter(validReference);
  if (!references.length) return gap;

  if (assessment.match_layer === "exact") {
    // Recheck the live wording: a saved exact result must not survive a task edit.
    // Multiple references contradict a one-to-one exact match, even if one is valid.
    if (assessment.matched_reference_tasks.length !== 1) return gap;
    const reference = references[0];
    if (
      !task.iloTaskId || reference.ilo_task_id !== task.iloTaskId ||
      normalizeWording(task.wording) !== normalizeWording(reference.task_text)
    ) return gap;
    return { kind: "linked", label: "Research linked", references };
  }

  if (assessment.match_layer === "nlp" || assessment.match_layer === "llm") {
    return { kind: "candidate", label: "Possible research link", references };
  }
  return gap;
}
