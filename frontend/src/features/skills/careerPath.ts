import { accountStorage, commitWorkspaceItems } from "../../services/accountStorage.ts";
import type { WefSkill } from "../../types/reference.ts";
import type { SkillRecommendation } from "./skillPath.ts";

const SHORTLIST = "aiwrevolusi.possibilities.shortlist";
const DIRECTION = "aiwrevolusi.possibilities.chosenDirection";
export function readCareerPath() {
  const ids: unknown = JSON.parse(accountStorage.getItem(SHORTLIST) ?? "[]");
  const direction = JSON.parse(accountStorage.getItem(DIRECTION) ?? "{}");
  if (!Array.isArray(ids) || !ids.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error("Your saved career skills could not be read. Reload your account before continuing.");
  const sources: unknown = direction?.skillSources ?? {};
  if (!sources || typeof sources !== "object" || Array.isArray(sources) || !Object.values(sources).every(value => typeof value === "string")) throw new Error("Your saved career sources could not be read. Reload your account before continuing.");
  return { ids: [...new Set(ids)] as number[], sources: sources as Record<string, string> };
}
export async function addCareerPathSkill(id: number, code: string, title: string) {
  const current = readCareerPath();
  const ids = [...new Set([...current.ids, id])];
  if (ids.length > 60) throw new Error("Your Skill Path has reached its saved skill limit.");
  await commitWorkspaceItems({
    [SHORTLIST]: JSON.stringify(ids),
    [DIRECTION]: JSON.stringify({ occupation_code: code, title, skill_id: id, skillSources: { ...current.sources, [id]: title } }),
  });
}
export function mergeCareerSkills(recommendations: SkillRecommendation[], skills: WefSkill[], ids: number[]) {
  const result = [...recommendations];
  for (const id of ids) {
    const skill = skills.find(item => item.wef_skill_id === id);
    if (skill && !result.some(item => item.skill.wef_skill_id === id)) result.push({ skill, tasks: [], highTaskCount: 0 });
  }
  return result;
}
