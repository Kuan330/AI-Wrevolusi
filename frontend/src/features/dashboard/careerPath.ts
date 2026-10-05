import type { PossibilityDirection, PossibilitySkill } from "../../services/possibilitiesTypes.ts";

export const CHOSEN_DIRECTION_KEY = "aiwrevolusi.possibilities.chosenDirection";
export type ChosenDirection = { occupationCode: string; title: string; skillId: number | null };

/** Reads the choice saved by Possibilities; anything malformed counts as no choice. */
export function parseChosenDirection(raw: string | null): ChosenDirection | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.occupation_code !== "string" || !value.occupation_code) return null;
    return {
      occupationCode: value.occupation_code,
      title: typeof value.title === "string" ? value.title : "",
      skillId: Number.isInteger(value.skill_id) ? value.skill_id : null,
    };
  } catch {
    return null;
  }
}

const isMatched = (skill: PossibilitySkill) => skill.state === "have" || skill.state === "learning" || skill.state === "suggested";

/** Matches the Possibilities page: skills matched from work, learning or task text count; none of it is a skill level. */
export function careerPathProgress(direction: PossibilityDirection, chosenSkillId: number | null = null) {
  const skills = direction.skills;
  const have = skills.filter(skill => skill.state === "have");
  const learning = skills.filter(skill => skill.state === "learning");
  const suggested = skills.filter(skill => skill.state === "suggested");
  const gaps = skills.filter(skill => !isMatched(skill));
  const nextGap = gaps.find(skill => skill.skill_id === chosenSkillId) ?? gaps.find(skill => skill.state === "shortlisted") ?? gaps[0] ?? null;
  return {
    title: direction.title,
    total: skills.length,
    have,
    learning,
    suggested,
    gaps,
    nextGap,
    percent: skills.length ? Math.round((have.length + learning.length + suggested.length) / skills.length * 100) : 0,
  };
}
