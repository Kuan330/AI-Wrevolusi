import { accountStorage } from "@/infrastructure/storage/accountStorage";
import { STORAGE_KEYS } from "@/infrastructure/storage/keys";
export type LearningSkill = {
  id: string;
  name: string;
  source?: "work" | "wef";
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
export function readLearningSkills(): LearningSkill[] | null {
  const raw = accountStorage.getItem(STORAGE_KEYS.learningSkills);
  if (!raw) return null;
  const stored = JSON.parse(raw);
  const context = accountStorage.getItem(STORAGE_KEYS.confirmedAnalysis) ?? "";
  if (
    !Array.isArray(stored) &&
    stored?.version === 2 &&
    stored.context !== context
  )
    return null;
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
    accountStorage.getItem(STORAGE_KEYS.confirmedAnalysis) ?? "";
  let previousContext = nextContext;
  try {
    const previous = JSON.parse(
      accountStorage.getItem(STORAGE_KEYS.learningSkills) ?? "null",
    );
    previousContext =
      typeof previous?.context === "string" ? previous.context : nextContext;
  } catch {
    previousContext = nextContext;
  }
  accountStorage.setItem(
    STORAGE_KEYS.learningSkills,
    JSON.stringify({ version: 2, context: nextContext, skills }),
  );
  if (previousContext !== nextContext) {
    accountStorage.removeItem(STORAGE_KEYS.courseLibrary);
    accountStorage.removeItem(STORAGE_KEYS.planner);
    accountStorage.removeItem(STORAGE_KEYS.learningResourceSelections);
  }
}
// Editorial course associations based on catalogue topics; these are not WEF recommendations.
const courseLinks: Record<string, string[]> = {
  "ai-and-big-data": ["c2", "c4", "c12", "c13", "c14"],
  "technological-literacy": ["c5", "c6", "c11"],
  "creative-thinking": ["c8"],
  "curiosity-and-lifelong-learning": ["c8"],
  "analytical-thinking": ["c2", "c3", "c4", "c6", "c7", "c8", "c14"],
  "empathy-and-active-listening": ["c9"],
  "leadership-and-social-influence": ["c9", "c15"],
  "reading-writing-and-mathematics": ["c7", "c10"],
  "resource-management-and-operations": ["c15"],
  "service-orientation-and-customer-service": ["c9"],
  programming: ["c1", "c13"],
};
export const coursesForSkill = (id: string) => courseLinks[id] ?? [];

export function reconcileLearningSkills(
  saved: LearningSkill[] | null,
  work: LearningSkill[],
): LearningSkill[] {
  if (!saved) return work;
  const current = new Set(work.map((skill) => skill.id));
  return saved.filter(
    (skill) =>
      current.has(skill.id) ||
      (skill.source === "wef" &&
        growingSkills.some((item) => item.id === skill.id)),
  );
}
