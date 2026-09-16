/** Page-only data boundary. Replace this loader with a course API adapter later.
 * Stable theme IDs map to WEF skill IDs; course level describes content, not ability.
 * Demo completion must never be written to the real learning plan.
 */
export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";
export type ExplorationCourse = { id: string; title: string; themeId: string; level: CourseLevel; completed: boolean; started: boolean };
export type ExplorationTheme = { id: string; name: string };
export type ExplorationDirection = { id: string; title: string; area: string; description: string; themeIds: string[] };
export type PossibilitiesData = { source: "demo" | "live"; themes: ExplorationTheme[]; courses: ExplorationCourse[]; currentThemeIds: string[]; currentRoleThemeIds: string[]; directions: ExplorationDirection[] };
export async function loadPossibilitiesData(): Promise<PossibilitiesData> {
  const themes = [
    { id: "WEF-01", name: "Analytical thinking" },
    { id: "WEF-04", name: "Creative thinking" },
    { id: "WEF-03", name: "Leadership and social influence" },
    { id: "WEF-06", name: "Technological literacy" },
    { id: "demo-communication", name: "Communication" },
    { id: "demo-project-planning", name: "Project planning" },
  ];
  const levels: CourseLevel[] = ["Beginner", "Intermediate", "Advanced"];
  return {
    source: "demo", themes,
    currentThemeIds: ["WEF-04", "WEF-03", "demo-communication"],
    currentRoleThemeIds: ["WEF-04", "WEF-03", "demo-communication", "WEF-06"],
    courses: themes.flatMap((theme, ti) => levels.flatMap((level, li) => [1, 2].map(n => ({
      id: `${theme.id}-${level}-${n}`, title: `${theme.name} · ${level} ${n}`,
      themeId: theme.id, level, completed: ti === 0 && li === 0,
      started: (ti === 0 && li <= 1) || (ti === 3 && li === 0),
    })))),
    directions: [
      { id: "marketing", title: "Marketing Analyst", area: "Analysis & insights", description: "Explore how customer information, creative thinking and digital tools support marketing decisions.", themeIds: ["WEF-01", "WEF-04", "WEF-06", "demo-communication", "demo-project-planning"] },
      { id: "business", title: "Business Analyst", area: "Business & change", description: "Explore ways to understand business needs and communicate practical improvements.", themeIds: ["WEF-01", "WEF-03", "WEF-06", "demo-communication", "demo-project-planning"] },
      { id: "project", title: "Project Coordinator", area: "Planning & collaboration", description: "Explore how people, ideas and digital tools help teams organise their work.", themeIds: ["WEF-03", "WEF-04", "WEF-06", "demo-project-planning"] },
    ],
  };
}

export type SkillGroup = "have" | "learning" | "planned" | "missing";
export function skillGroup(data: PossibilitiesData, id: string, planned: string[]): SkillGroup {
  if (data.currentThemeIds.includes(id)) return "have";
  if (data.courses.some(c => c.themeId === id && c.started)) return "learning";
  return planned.includes(id) ? "planned" : "missing";
}
/** Illustrative reference-design weighting, not a validated employment score. */
export function directionMatch(data: PossibilitiesData, ids: string[], planned: string[]): number {
  if (!ids.length) return 0;
  return Math.round(ids.reduce((sum, id) => {
    const group = skillGroup(data, id, planned);
    const courses = data.courses.filter(c => c.themeId === id);
    const credit = group === "have" ? 1 : group === "planned" ? 0.35 : group === "learning" ? 0.15 + (courses.filter(c => c.completed).length / Math.max(1, courses.length)) * 0.75 : 0;
    return sum + credit;
  }, 0) / ids.length * 100);
}
