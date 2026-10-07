import { accountStorage } from "../../services/accountStorage.ts";
export type LearningSkill = {
  id: string;
  name: string;
  source?: "work" | "wef" | "custom" | "other-role";
};
export const skillKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const growingSkills: LearningSkill[] = [
  "AI and big data",
  "Networks and cybersecurity",
  "Technological literacy",
  "Creative thinking",
  "Resilience, flexibility and agility",
  "Curiosity and lifelong learning",
  "Leadership and social influence",
  "Talent management",
  "Analytical thinking",
  "Environmental stewardship",
].map((name) => ({ id: skillKey(name), name, source: "wef" }));
const KEY = "aiwrevolusi.learningSkills.v1";
export function readLearningSkills(): LearningSkill[] | null {
  const raw = accountStorage.getItem(KEY);
  if (!raw) return null;
  const stored = JSON.parse(raw);
  const parsed: unknown = Array.isArray(stored) ? stored : stored?.skills;
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        item &&
        typeof item.name === "string" &&
        typeof item.id === "string" &&
        item.id === skillKey(item.name),
    )
  )
    throw new Error(
      "Your learning skills could not be read. Please reload before saving.",
    );
  return [...new Map(parsed.map((item) => [item.id, item])).values()];
}
export function saveLearningSkills(skills: LearningSkill[]) {
  const nextContext =
    accountStorage.getItem("aiwrevolusi.confirmedAnalysis") ?? "";
  accountStorage.setItem(
    KEY,
    JSON.stringify({ version: 2, context: nextContext, skills }),
  );

}
export function reconcileLearningSkills(
  saved: LearningSkill[] | null,
  work: LearningSkill[],
): LearningSkill[] {
  // Work evidence is the default list, including skills without course mappings.
  // Keep manually added skills, but use the current work source for overlaps.
  const merged = new Map(work.map(skill => [skill.id, skill]));
  for (const skill of saved ?? []) {
    if (!merged.has(skill.id) && (skill.source === "custom" || skill.source === "wef" || skill.source === "other-role")) {
      merged.set(skill.id, skill);
    }
  }
  return [...merged.values()];
}

/** Convert a skill name into a LearningSkill for storage. */
export function toLearningSkill(
  name: string,
  source: LearningSkill["source"] = "work",
): LearningSkill {
  return { id: skillKey(name), name, source };
}

/**
 * Return stored learning skills, or seed from work-reflected skills when empty.
 * Seeds persist so Learning Resources and AI Impact stay in sync.
 */
export function ensureLearningSkills(work: LearningSkill[]): LearningSkill[] {
  let saved: LearningSkill[] | null = null;
  try {
    saved = readLearningSkills();
  } catch {
    saved = null;
  }
  if (saved && saved.length > 0) {
    const next = reconcileLearningSkills(saved, work);
    if (JSON.stringify(next) !== JSON.stringify(saved)) saveLearningSkills(next);
    return next;
  }
  if (work.length > 0) {
    saveLearningSkills(work);
    return work;
  }
  return [];
}
