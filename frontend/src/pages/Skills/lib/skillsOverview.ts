import type { ProfileTask } from "../../../features/work-profile/types";
import type { SpecialistEntry } from "../../../features/journey/specialistSkills";
import type { PersonalSkill, SkillDecision } from "../../../features/journey/journey";
import type { WefSkill } from "../../../types/reference";
import type { SpecialistSkill } from "../../../services/specialistSkillService";

export type OverviewTaskLink = {
  id: string;
  wording: string;
  decision: null | "use" | "no" | "unsure" | "accepted" | "rejected";
  wantsLearning: boolean;
  sourceVersion?: string;
  needsReview: boolean;
  sourceCheck: boolean;
  suggested: boolean;
};
export type SkillsOverviewRow = {
  key: string;
  label: string;
  source: "esco" | "personal" | "wef";
  kind: "skill" | "knowledge" | "unspecified" | "unknown" | "broad";
  tasks: OverviewTaskLink[];
  currentTaskIds: string[];
  sourceCheck: boolean;
  confirmed: boolean;
  reportedUse: boolean;
  wantsLearning: boolean;
  needsReview: boolean;
  suggested: boolean;
  goalIds: string[];
};
export type SkillsOverviewInput = {
  tasks: readonly ProfileTask[];
  occupationCode: string | null;
  specialist: readonly SpecialistEntry[];
  personal: readonly PersonalSkill[];
  broad: readonly { skill: WefSkill; tasks: readonly ProfileTask[] }[];
  decisions: Readonly<Record<string, SkillDecision | undefined>>;
  broadNeedsReview: boolean;
  candidates: readonly { taskId: string; taskWording: string; version: string; skills: readonly SpecialistSkill[] }[];
  goals: readonly { id: string; sourceKey: string; wording: string; initial: { skill: { source: string; id: string | number; label: string } } }[];
  catalogueVersion: string | null;
};

/** Combines discovery and self reports without upgrading suggestions into ability. */
export function buildSkillsOverview(input: SkillsOverviewInput) {
  const rows = new Map<string, SkillsOverviewRow>();
  const isCurrent = (id: string, wording: string) => input.tasks.some(task => task.id === id && task.wording === wording);
  function row(key: string, label: string, source: SkillsOverviewRow["source"], kind: SkillsOverviewRow["kind"]) {
    let item = rows.get(key);
    if (!item) {
      item = { key, label, source, kind, tasks: [], currentTaskIds: [], sourceCheck: false, confirmed: false, reportedUse: false, wantsLearning: false, needsReview: false, suggested: false, goalIds: [] };
      rows.set(key, item);
    }
    if (kind !== "unknown") item.kind = kind;
    return item;
  }
  function link(item: SkillsOverviewRow, value: OverviewTaskLink) {
    // A candidate does not replace an earlier statement needing review.
    const previous = item.tasks.find(task => task.id === value.id && task.wording === value.wording && task.sourceVersion === value.sourceVersion && task.needsReview === value.needsReview);
    if (!previous) item.tasks.push(value);
    else if (value.decision !== null || value.wantsLearning) Object.assign(previous, value);
  }

  for (const entry of input.specialist) {
    const item = row(`esco:${entry.skillUri}`, entry.skillLabel, "esco", "unknown");
    const needsReview = entry.occupationCode !== input.occupationCode || !isCurrent(entry.taskId, entry.taskWording) || (input.catalogueVersion !== null && entry.sourceVersion !== input.catalogueVersion);
    link(item, { id: entry.taskId, wording: entry.taskWording, decision: entry.decision, wantsLearning: entry.wantsLearning, sourceVersion: entry.sourceVersion, needsReview, sourceCheck: input.catalogueVersion === null, suggested: entry.decision === null && !entry.wantsLearning });
  }
  for (const candidate of input.candidates) {
    if (!isCurrent(candidate.taskId, candidate.taskWording)) continue;
    for (const skill of candidate.skills) {
      const kind = skill.skill_type === "knowledge" ? "knowledge" : skill.skill_type === "unspecified" ? "unspecified" : ["skill", "competence", "skill/competence"].includes(skill.skill_type) ? "skill" : "unknown";
      const item = row(`esco:${skill.uri}`, skill.label, "esco", kind);
      link(item, { id: candidate.taskId, wording: candidate.taskWording, decision: null, wantsLearning: false, sourceVersion: candidate.version, needsReview: input.catalogueVersion !== null && candidate.version !== input.catalogueVersion, sourceCheck: input.catalogueVersion === null, suggested: true });
    }
  }
  for (const entry of input.personal) {
    const item = row(`personal:${entry.id}`, entry.name, "personal", "skill");
    entry.taskIds.forEach((id, index) => {
      const wording = entry.taskLabels[index];
      link(item, { id, wording, decision: entry.decision ?? null, wantsLearning: entry.wantsLearning ?? false, needsReview: !isCurrent(id, wording), sourceCheck: false, suggested: false });
    });
  }
  for (const evidence of input.broad) {
    const item = row(`wef:${evidence.skill.wef_skill_id}`, evidence.skill.core_skill, "wef", "broad");
    for (const task of evidence.tasks) {
      const decision = input.decisions[String(evidence.skill.wef_skill_id)] ?? null;
      link(item, { id: task.id, wording: task.wording, decision, wantsLearning: false, needsReview: !isCurrent(task.id, task.wording) || (input.broadNeedsReview && decision === "accepted"), sourceCheck: false, suggested: decision === null });
    }
  }
  for (const goal of input.goals) {
    const skill = goal.initial.skill;
    const key = skill.source === "esco" ? `esco:${skill.id}` : skill.source === "wef" ? `wef:${skill.id}` : goal.sourceKey.startsWith("personal:") ? goal.sourceKey : null;
    const item = key ? rows.get(key) : undefined;
    if (item && !item.goalIds.includes(goal.id)) item.goalIds.push(goal.id);
  }
  const result = [...rows.values()].map(item => {
    const current = item.tasks.filter(task => !task.needsReview);
    item.currentTaskIds = [...new Set(current.map(task => task.id))];
    item.confirmed = current.some(task => task.decision === "use" || task.decision === "accepted");
    item.reportedUse = current.some(task => task.decision === "use");
    item.wantsLearning = current.some(task => task.wantsLearning);
    item.needsReview = item.tasks.some(task => task.needsReview);
    item.sourceCheck = item.tasks.some(task => task.sourceCheck);
    item.suggested = current.some(task => task.suggested);
    return item;
  }).sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  return {
    rows: result,
    currentTaskIds: [...new Set(result.flatMap(item => item.currentTaskIds))],
    counts: {
      total: result.length,
      confirmed: result.filter(item => item.confirmed).length,
      reportedUse: result.filter(item => item.reportedUse).length,
      wantsLearning: result.filter(item => item.wantsLearning).length,
      suggested: result.filter(item => item.suggested).length,
      needsReview: result.filter(item => item.needsReview).length,
      sourceCheck: result.filter(item => item.sourceCheck).length,
    },
  };
}
