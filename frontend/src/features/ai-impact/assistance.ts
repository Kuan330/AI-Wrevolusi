import type { UserProfile } from "../work-profile/userProfile.ts";
import type { ProfileTask } from "../work-profile/types.ts";
import type { ConfirmedTaskExposureAssessment } from "../../services/exposureService.ts";
import { taskResearch } from "./taskResearch.ts";

export const ASSISTANCE_LABELS = {
  human: "Human-led", partial: "Partially AI-assisted", high: "Highly AI-assisted", unverified: "Unverified",
} as const;
export type AssistanceCategory = keyof typeof ASSISTANCE_LABELS;

export const ASSISTANCE_DESCRIPTIONS: Record<AssistanceCategory, string> = {
  human: "Mainly human-led, with limited AI support.",
  partial: "AI may support selected steps, with human review.",
  high: "AI may support many steps, with human oversight.",
  unverified: "No supported match with existing AI exposure data.",
};

/** Old analysis and edited task wording must never contribute to the dashboard. */
export function currentAssessments(profile: UserProfile): ConfirmedTaskExposureAssessment[] {
  const analysis = profile.tasksConfirmed && profile.analysis?.classificationCheck === "same-title-v1" ? profile.analysis : null;
  return (analysis?.taskExposureAssessments ?? []).filter(item => profile.tasks.some(task =>
    task.id === item.task_id && analysis?.tasks.some(saved => saved.id === task.id && saved.wording === task.wording),
  ));
}

export function assistanceForTask(task: ProfileTask, assessment?: ConfirmedTaskExposureAssessment) {
  const research = taskResearch(task, assessment);
  const score = research.kind === "linked" ? research.references[0].score_2025 : null;
  // Same thresholds as the existing exposure service, applied to linked source evidence.
  // Candidate matches remain unverified rather than becoming invented personal scores.
  const category: AssistanceCategory = score === null ? "unverified" : score < 0.25 ? "human" : score < 0.55 ? "partial" : "high";
  return { task, score, category, label: ASSISTANCE_LABELS[category] };
}
export function assistanceOverview(tasks: ProfileTask[], assessments: ConfirmedTaskExposureAssessment[]) {
  const byId = new Map(assessments.map(item => [item.task_id, item]));
  const items = tasks.map(task => assistanceForTask(task, byId.get(task.id)));
  const groups = (["high", "partial", "human"] as const).map(category => ({ category, label: ASSISTANCE_LABELS[category], count: items.filter(item => item.category === category).length }));
  groups.sort((a, b) => b.count - a.count);
  return { items, groups, unverified: items.filter(item => item.category === "unverified").length };
}
